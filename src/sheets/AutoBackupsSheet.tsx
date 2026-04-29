import React, {
  forwardRef,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { Alert } from "react-native";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { Sheet, SheetRef } from "../ui/Sheet";
import { Grouped } from "../ui/Grouped";
import { Row, RowEmpty } from "../ui/Row";
import { Store } from "../store/store";
import { listAutoBackups } from "../lib/autoBackup";
import { DEFAULT_CATEGORIES } from "../lib/constants";

export interface AutoBackupsSheetRef {
  open: () => void;
}

interface BackupItem {
  name: string;
  uri: string;
  size: number;
  mtime?: number;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function formatDateFromName(name: string): string {
  const m = name.match(/backup-(\d{4}-\d{2}-\d{2})/);
  if (!m) return name;
  const [y, mo, d] = m[1].split("-");
  return `${d}.${mo}.${y}`;
}

export const AutoBackupsSheet = forwardRef<AutoBackupsSheetRef>(
  function AutoBackupsSheet(_, ref) {
    const sheet = useRef<SheetRef>(null);
    const [items, setItems] = useState<BackupItem[]>([]);
    const [loading, setLoading] = useState(false);

    async function refresh() {
      setLoading(true);
      try {
        const list = await listAutoBackups();
        setItems(list);
      } finally {
        setLoading(false);
      }
    }

    useImperativeHandle(
      ref,
      () => ({
        open() {
          setItems([]);
          refresh();
          sheet.current?.open();
        },
      }),
      [],
    );

    async function shareItem(item: BackupItem) {
      try {
        const can = await Sharing.isAvailableAsync();
        if (!can) {
          Alert.alert("Paylaşım yok", `Dosya: ${item.uri}`);
          return;
        }
        await Sharing.shareAsync(item.uri, {
          mimeType: "application/json",
          dialogTitle: "Otomatik yedeği paylaş",
          UTI: "public.json",
        });
      } catch (e: unknown) {
        Alert.alert("Hata", e instanceof Error ? e.message : "");
      }
    }

    async function restore(item: BackupItem) {
      Alert.alert(
        "Bu yedekten yükle",
        `${formatDateFromName(item.name)} tarihli yedek mevcut verinin üzerine yazılacak. Devam edilsin mi?`,
        [
          { text: "Vazgeç", style: "cancel" },
          {
            text: "Yükle",
            style: "destructive",
            onPress: async () => {
              try {
                const txt = await FileSystem.readAsStringAsync(item.uri);
                const data = JSON.parse(txt);
                const incoming = data?.state || data;
                if (!incoming || !Array.isArray(incoming.transactions)) {
                  Alert.alert("Hata", "Yedek dosyası okunamadı.");
                  return;
                }
                Store.replace({
                  transactions: incoming.transactions || [],
                  pending: incoming.pending || [],
                  recurring: incoming.recurring || [],
                  goals: incoming.goals || [],
                  assets: incoming.assets || [],
                  debts: incoming.debts || [],
                  templates: incoming.templates || [],
                  categories: {
                    income: incoming.categories?.income || [
                      ...DEFAULT_CATEGORIES.income,
                    ],
                    expense: incoming.categories?.expense || [
                      ...DEFAULT_CATEGORIES.expense,
                    ],
                  },
                  settings: {
                    onboarded: true,
                    ...(incoming.settings || {}),
                  },
                });
                sheet.current?.close();
                Alert.alert("Başarılı", "Yedek yüklendi.");
              } catch (e: unknown) {
                Alert.alert(
                  "Hata",
                  e instanceof Error ? e.message : "Geçersiz dosya",
                );
              }
            },
          },
        ],
      );
    }

    async function remove(item: BackupItem) {
      Alert.alert("Sil", `${item.name} silinsin mi?`, [
        { text: "Vazgeç", style: "cancel" },
        {
          text: "Sil",
          style: "destructive",
          onPress: async () => {
            try {
              await FileSystem.deleteAsync(item.uri, { idempotent: true });
              await refresh();
            } catch {}
          },
        },
      ]);
    }

    return (
      <Sheet ref={sheet} title="Otomatik Yedekler" cancelLabel="Kapat">
        <Grouped
          header="Cihazda saklanan yedekler"
          footer="Her 7 günde bir otomatik oluşturulur. Son 4 yedek tutulur."
        >
          {loading ? (
            <RowEmpty>Yükleniyor…</RowEmpty>
          ) : items.length === 0 ? (
            <RowEmpty>Henüz otomatik yedek yok.</RowEmpty>
          ) : (
            items.map((item, i) => (
              <Row
                key={item.name}
                icon="doc"
                iconColor="blue"
                title={formatDateFromName(item.name)}
                sub={formatSize(item.size)}
                onPress={() => restore(item)}
                onLongPress={() => shareItem(item)}
                swipeActions={[
                  {
                    label: "Sil",
                    tone: "danger",
                    onPress: () => remove(item),
                  },
                  {
                    label: "Paylaş",
                    tone: "primary",
                    onPress: () => shareItem(item),
                  },
                ]}
                isFirst={i === 0}
              />
            ))
          )}
        </Grouped>
      </Sheet>
    );
  },
);
