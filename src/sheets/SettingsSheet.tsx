import React, { forwardRef, useImperativeHandle, useRef } from "react";
import { Alert, Switch } from "react-native";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import * as DocumentPicker from "expo-document-picker";
import { Sheet, SheetRef } from "../ui/Sheet";
import { Grouped } from "../ui/Grouped";
import { Row } from "../ui/Row";
import { Store, useStore } from "../store/store";
import { STATE_VERSION, DEFAULT_CATEGORIES } from "../lib/constants";
import { fmtDate, normalizeTags, todayISO } from "../lib/format";
import { Transaction } from "../store/types";
import {
  cancelAll,
  ensurePermissions,
  isAvailable,
  scheduleRecurringReminders,
} from "../lib/notifications";
import { decrypt, encrypt, isEncryptedPayload } from "../lib/crypto";
import { csvFilename, transactionsToCsv } from "../lib/csv";
import { sweepOrphanPhotos } from "../lib/photos";
import { formatBytes, probeStorage, StorageUsage } from "../lib/storage";
import {
  authenticate,
  biometricLabel,
  isBiometricAvailable,
} from "../lib/biometric";

export interface SettingsSheetRef {
  open: () => void;
}

interface Props {
  onOpenCategories?: () => void;
  onOpenAutoBackups?: () => void;
  onOpenDiagnostics?: () => void;
}

export const SettingsSheet = forwardRef<SettingsSheetRef, Props>(
  function SettingsSheet(
    { onOpenCategories, onOpenAutoBackups, onOpenDiagnostics },
    ref,
  ) {
    const sheet = useRef<SheetRef>(null);
    const state = useStore((s) => s);
    const tapCountRef = useRef(0);
    const tapResetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    useImperativeHandle(
      ref,
      () => ({
        open() {
          sheet.current?.open();
        },
      }),
      [],
    );

    function promptPassphrase(
      title: string,
      message: string,
      onOk: (pwd: string) => void,
    ) {
      if (typeof Alert.prompt !== "function") {
        Alert.alert(
          "Desteklenmiyor",
          "Bu cihaz parolalı yedek diyaloğunu desteklemiyor.",
        );
        return;
      }
      Alert.prompt(
        title,
        message,
        [
          { text: "Vazgeç", style: "cancel" },
          {
            text: "Tamam",
            onPress: (pwd?: string) => {
              const trimmed = (pwd || "").trim();
              if (trimmed.length < 6) {
                Alert.alert("Parola çok kısa", "En az 6 karakter girin.");
                return;
              }
              onOk(trimmed);
            },
          },
        ],
        "secure-text",
      );
    }

    async function writeAndShare(fileUri: string, content: string) {
      await FileSystem.writeAsStringAsync(fileUri, content);
      const can = await Sharing.isAvailableAsync();
      if (can) {
        await Sharing.shareAsync(fileUri, {
          mimeType: "application/json",
          dialogTitle: "Bütçe yedeğini kaydet",
          UTI: "public.json",
        });
      } else {
        Alert.alert("Yedek hazır", `Dosya: ${fileUri}`);
      }
    }

    async function performExport(encrypted: boolean, password?: string) {
      try {
        const payload = {
          app: "ggai",
          version: STATE_VERSION,
          exportedAt: new Date().toISOString(),
          state: Store.state,
        };
        const today = todayISO();
        const plaintext = JSON.stringify(payload);
        let body: string;
        let suffix: string;
        if (encrypted && password) {
          const enc = encrypt(plaintext, password);
          body = JSON.stringify(enc, null, 2);
          suffix = "sifreli";
        } else {
          body = JSON.stringify(payload, null, 2);
          suffix = "acik";
        }
        const fileUri =
          FileSystem.cacheDirectory + `butce-yedek-${today}-${suffix}.json`;
        await writeAndShare(fileUri, body);
        Store.update((s) => {
          s.settings.lastBackup = today;
        });
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "";
        Alert.alert("Yedekleme hatası", msg);
      }
    }

    async function exportCsv() {
      try {
        const csv = transactionsToCsv(Store.state.transactions);
        const fileUri = FileSystem.cacheDirectory + csvFilename();
        await FileSystem.writeAsStringAsync(fileUri, csv);
        const can = await Sharing.isAvailableAsync();
        if (can) {
          await Sharing.shareAsync(fileUri, {
            mimeType: "text/csv",
            dialogTitle: "Hareketleri CSV olarak paylaş",
            UTI: "public.comma-separated-values-text",
          });
        } else {
          Alert.alert("CSV hazır", `Dosya: ${fileUri}`);
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "";
        Alert.alert("CSV hatası", msg);
      }
    }

    function exportData() {
      Alert.alert(
        "Yedek tipi",
        "Şifreli yedek paylaşmak güvenlidir; şifresiz daha kolay açılır.",
        [
          { text: "Vazgeç", style: "cancel" },
          {
            text: "Şifresiz",
            onPress: () => performExport(false),
          },
          {
            text: "Şifreli",
            onPress: () =>
              promptPassphrase(
                "Yedek parolası",
                "Yüklerken aynı parolayı gireceksin.",
                (pwd) => performExport(true, pwd),
              ),
          },
        ],
      );
    }

    function applyImported(incoming: Record<string, unknown>) {
      type LooseState = Partial<{
        transactions: unknown[];
        pending: unknown[];
        recurring: unknown[];
        goals: unknown[];
        assets: unknown[];
        debts: unknown[];
        templates: unknown[];
        categories: { income?: string[]; expense?: string[] };
        settings: Record<string, unknown>;
      }>;
      const ix = incoming as LooseState;
      // Sanitize transactions: trim+dedup tags so legacy/3rd-party imports
      // don't introduce "iş" / "İş" duplicates.
      const cleanTx = ((ix.transactions as unknown[]) || []).map((raw) => {
        const tx = raw as Partial<Transaction>;
        if (!tx.tags || !Array.isArray(tx.tags)) return tx;
        const sanitized = normalizeTags(
          tx.tags.filter((t) => typeof t === "string") as string[],
        );
        return { ...tx, tags: sanitized.length ? sanitized : undefined };
      });
      Store.replace({
        transactions: cleanTx as never,
        pending: (ix.pending || []) as never,
        recurring: (ix.recurring || []) as never,
        goals: (ix.goals || []) as never,
        assets: (ix.assets || []) as never,
        debts: (ix.debts || []) as never,
        templates: (ix.templates || []) as never,
        categories: {
          income: ix.categories?.income || [...DEFAULT_CATEGORIES.income],
          expense: ix.categories?.expense || [...DEFAULT_CATEGORIES.expense],
        },
        // Preserve incoming onboarded if present; otherwise default to true
        // (user just imported a backup → shouldn't see onboarding again).
        settings: {
          onboarded: true,
          ...(ix.settings || {}),
        } as never,
      });
      sheet.current?.close();
      Alert.alert("Başarılı", "Yedek yüklendi.");
    }

    async function importData() {
      try {
        const res = await DocumentPicker.getDocumentAsync({
          type: ["application/json", "text/plain"],
          copyToCacheDirectory: true,
        });
        if (res.canceled) return;
        const file = res.assets[0];
        const txt = await FileSystem.readAsStringAsync(file.uri);
        const raw = JSON.parse(txt);

        const proceedWith = (incoming: Record<string, unknown>) => {
          if (
            !incoming ||
            !Array.isArray(
              (incoming as { transactions?: unknown }).transactions,
            )
          ) {
            Alert.alert("Hata", "Geçersiz yedek içeriği.");
            return;
          }
          Alert.alert(
            "Yedekten yükle",
            "Mevcut tüm verinin üzerine yazılacak. Devam edilsin mi?",
            [
              { text: "Vazgeç", style: "cancel" },
              {
                text: "Yükle",
                style: "destructive",
                onPress: () => applyImported(incoming),
              },
            ],
          );
        };

        if (isEncryptedPayload(raw)) {
          promptPassphrase(
            "Şifreli yedek",
            "Yedeğin parolasını gir.",
            (pwd) => {
              try {
                const plaintext = decrypt(raw, pwd);
                const data = JSON.parse(plaintext);
                const incoming = data?.state || data;
                proceedWith(incoming);
              } catch (e: unknown) {
                const msg = e instanceof Error ? e.message : "Parola hatası";
                Alert.alert("Açılamadı", msg);
              }
            },
          );
          return;
        }

        const incoming = raw?.state || raw;
        proceedWith(incoming);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Geçersiz dosya";
        Alert.alert("Hata", msg);
      }
    }

    function reset() {
      Alert.alert(
        "Tüm veriyi sil",
        "TÜM veriler silinecek. Önce yedek almanı öneririm. Devam?",
        [
          { text: "Vazgeç", style: "cancel" },
          {
            text: "Devam",
            style: "destructive",
            onPress: () => {
              Alert.alert("Emin misin?", "Bu işlem geri alınamaz.", [
                { text: "Vazgeç", style: "cancel" },
                {
                  text: "Sil",
                  style: "destructive",
                  onPress: () => {
                    Store.reset();
                    sheet.current?.close();
                  },
                },
              ]);
            },
          },
        ],
      );
    }

    const [bioLabel, setBioLabel] = React.useState("Face ID / Touch ID");
    const [bioAvailable, setBioAvailable] = React.useState(false);
    const [storage, setStorage] = React.useState<StorageUsage | null>(null);

    React.useEffect(() => {
      let cancelled = false;
      Promise.all([isBiometricAvailable(), biometricLabel()]).then(
        ([avail, label]) => {
          if (cancelled) return;
          setBioAvailable(avail);
          setBioLabel(label);
        },
      );
      probeStorage().then((s) => {
        if (!cancelled) setStorage(s);
      });
      return () => {
        cancelled = true;
      };
    }, []);

    async function refreshStorage() {
      const s = await probeStorage();
      setStorage(s);
    }

    async function toggleBiometric(v: boolean) {
      if (v) {
        if (!bioAvailable) {
          Alert.alert(
            "Biyometrik kullanılamıyor",
            "Cihazda Face ID/Touch ID kurulu değil veya destek yok.",
          );
          return;
        }
        const ok = await authenticate(`${bioLabel} ile doğrula`);
        if (!ok) {
          Alert.alert("Doğrulanamadı", "Biyometrik kilit etkinleştirilmedi.");
          return;
        }
      }
      Store.update((s) => {
        s.settings.biometricLock = v;
      });
    }

    async function toggleNotifs(v: boolean) {
      if (v) {
        if (!isAvailable()) {
          Alert.alert(
            "Bildirim modülü yok",
            "Bildirimleri açmak için: npx expo install expo-notifications",
          );
          return;
        }
        const ok = await ensurePermissions();
        if (!ok) {
          Alert.alert("İzin verilmedi", "Bildirim izni reddedildi.");
          return;
        }
        const hour = Store.state.settings.notifyHour ?? 9;
        const minute = Store.state.settings.notifyMinute ?? 0;
        await scheduleRecurringReminders(Store.state.recurring, hour, minute);
      } else {
        await cancelAll();
      }
      Store.update((s) => {
        s.settings.notifications = v;
      });
    }

    function pickNotifyTime() {
      const choices: { label: string; h: number; m: number }[] = [
        { label: "08:00", h: 8, m: 0 },
        { label: "09:00", h: 9, m: 0 },
        { label: "12:00", h: 12, m: 0 },
        { label: "18:00", h: 18, m: 0 },
        { label: "20:00", h: 20, m: 0 },
        { label: "21:30", h: 21, m: 30 },
      ];
      Alert.alert("Hatırlatma saati", undefined, [
        ...choices.map((c) => ({
          text: c.label,
          onPress: () => setNotifyTime(c.h, c.m),
        })),
        { text: "Vazgeç", style: "cancel" as const },
      ]);
    }

    async function setNotifyTime(hour: number, minute: number) {
      Store.update((s) => {
        s.settings.notifyHour = hour;
        s.settings.notifyMinute = minute;
      });
      if (Store.state.settings.notifications && isAvailable()) {
        await scheduleRecurringReminders(Store.state.recurring, hour, minute);
      }
    }

    const exportSub = state.settings.lastBackup
      ? `Son yedek: ${fmtDate(state.settings.lastBackup)}`
      : "Tüm verilerin tek dosyada";

    const meta = `Bütçe v1 · ${state.transactions.length} hareket · ${state.pending.length} bekleyen · ${state.assets.length} varlık`;

    async function sweepReceipts() {
      const r = await sweepOrphanPhotos(
        Store.state.transactions.map((t) => t.photoUri),
      );
      await refreshStorage();
      Alert.alert(
        "Temizlik tamam",
        r.deleted === 0
          ? "Yetim fiş yok, alan tertemiz."
          : `${r.deleted} yetim fiş silindi.`,
      );
    }

    function showPrivacy() {
      Alert.alert(
        "Gizlilik",
        [
          "• Verin yalnızca bu cihazda saklanır.",
          "• Sunucu, hesap, takip yok.",
          "• Yedekler şifreli paylaşabilirsin.",
          "• Fiyatlar truncgil, TCMB ve open.er-api üzerinden anonim çekilir.",
          "• Hisse fiyatları için Yahoo Finance API'si kullanılır.",
          "• Reklam yok, üçüncü parti analitik yok.",
        ].join("\n"),
        [{ text: "Tamam" }],
      );
    }

    return (
      <Sheet ref={sheet} title="Ayarlar" cancelLabel="Kapat">
        {onOpenCategories && (
          <Grouped header="Bütçe">
            <Row
              icon="tag"
              iconColor="orange"
              title="Kategoriler"
              sub={`${state.categories.expense.length} gider · ${state.categories.income.length} gelir`}
              chevron
              onPress={() => {
                sheet.current?.close();
                setTimeout(() => onOpenCategories(), 250);
              }}
              isFirst
            />
          </Grouped>
        )}

        <Grouped
          header="Gizlilik"
          footer={
            bioAvailable
              ? `${bioLabel} ile uygulamayı kilitle`
              : "Bu cihazda biyometrik kullanılamıyor"
          }
        >
          <Row
            icon="check"
            iconColor="indigo"
            title={bioLabel}
            sub={
              state.settings.biometricLock
                ? "Açılışta kimlik doğrulama"
                : "Kapalı"
            }
            isFirst
            rightSlot={
              <Switch
                value={!!state.settings.biometricLock}
                onValueChange={toggleBiometric}
                disabled={!bioAvailable}
              />
            }
          />
          <Row
            icon="check"
            iconColor="green"
            title="Verilerin nereye gidiyor?"
            sub="Cihazda kalır, paylaşmadıkça hiçbir yere gitmez"
            chevron
            onPress={showPrivacy}
          />
        </Grouped>

        <Grouped header="Bildirimler" footer="Abonelik tarihinde hatırlatır">
          <Row
            icon="bell"
            iconColor="orange"
            title="Hatırlatıcılar"
            sub={
              isAvailable()
                ? "Aboneliklerin günü gelince uyarı"
                : "Modül kurulu değil"
            }
            isFirst
            rightSlot={
              <Switch
                value={!!state.settings.notifications}
                onValueChange={toggleNotifs}
              />
            }
          />
          {!!state.settings.notifications && (
            <Row
              icon="calendar"
              iconColor="indigo"
              title="Saat"
              sub="Bildirimin gönderileceği saat"
              value={`${String(state.settings.notifyHour ?? 9).padStart(2, "0")}:${String(state.settings.notifyMinute ?? 0).padStart(2, "0")}`}
              chevron
              onPress={pickNotifyTime}
            />
          )}
        </Grouped>

        <Grouped header="Yedekleme">
          <Row
            icon="arrow-down"
            iconColor="blue"
            title="Yedek Paylaş"
            sub={exportSub}
            chevron
            onPress={exportData}
            isFirst
          />
          <Row
            icon="doc"
            iconColor="purple"
            title="CSV Olarak Aktar"
            sub="Excel/Numbers için hareket listesi"
            chevron
            onPress={exportCsv}
          />
          <Row
            icon="trash"
            iconColor="gray"
            title="Yetim Fişleri Temizle"
            sub="Silinen hareketlerden artakalan dosyalar"
            chevron
            onPress={sweepReceipts}
          />
          {storage && (
            <Row
              icon="briefcase"
              iconColor="gray"
              title="Disk Kullanımı"
              sub={`${storage.receiptsCount} fiş · ${storage.backupsCount} otomatik yedek`}
              value={formatBytes(storage.totalBytes)}
              onPress={refreshStorage}
            />
          )}
          <Row
            icon="arrow-up"
            iconColor="green"
            title="Yedekten Yükle"
            sub="Mevcut verinin üzerine yazılır"
            chevron
            onPress={importData}
          />
          {onOpenAutoBackups && (
            <Row
              icon="refresh"
              iconColor="indigo"
              title="Otomatik Yedekler"
              sub="Cihazda saklanan haftalık yedekler"
              chevron
              onPress={() => {
                sheet.current?.close();
                setTimeout(() => onOpenAutoBackups(), 250);
              }}
            />
          )}
        </Grouped>

        <Grouped header="Tehlikeli Bölge" footer={meta}>
          <Row
            icon="trash"
            iconColor="red"
            title="Tüm Veriyi Sil"
            sub="Bu işlem geri alınamaz"
            onPress={reset}
            isFirst
          />
          <Row
            icon="dot"
            iconColor="gray"
            title="Bütçe v1"
            sub="Hızlıca 5 kez dokun"
            onPress={() => {
              tapCountRef.current += 1;
              if (tapResetTimer.current) clearTimeout(tapResetTimer.current);
              tapResetTimer.current = setTimeout(() => {
                tapCountRef.current = 0;
              }, 2000);
              if (tapCountRef.current >= 5) {
                tapCountRef.current = 0;
                if (onOpenDiagnostics) {
                  sheet.current?.close();
                  setTimeout(() => onOpenDiagnostics(), 250);
                }
              }
            }}
          />
        </Grouped>
      </Sheet>
    );
  },
);
