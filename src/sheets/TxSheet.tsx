import React, {
  forwardRef,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { Sheet, SheetRef } from "../ui/Sheet";
import {
  Segmented,
  Chip,
  ChipGrid,
  FieldLabel,
  DestructiveButton,
} from "../ui/Controls";
import { TextField } from "../ui/TextField";
import { DateField } from "../ui/DateField";
import { useTheme } from "../theme/tokens";
import { Store, useStore } from "../store/store";
import { TxType } from "../store/types";
import {
  fmtTRY,
  inputAmount,
  normalizeTags,
  parseAmount,
  todayISO,
  uid,
} from "../lib/format";
import { suggestCategory } from "../lib/insights";
import { deletePhoto, isLocalPhoto, persistPhoto } from "../lib/photos";
import { notifySuccess, notifyWarning } from "../lib/haptics";
import { PhotoViewer } from "../ui/PhotoViewer";

export interface TxSheetRef {
  open: (id?: string | null) => void;
}

export const TxSheet = forwardRef<TxSheetRef>(function TxSheet(_, ref) {
  const sheet = useRef<SheetRef>(null);
  const t = useTheme();
  const categories = useStore((s) => s.categories);
  const allTransactions = useStore((s) => s.transactions);
  const lastUsed = useStore((s) => s.settings.lastUsedCategory);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [type, setType] = useState<TxType>("expense");
  const [category, setCategory] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [desc, setDesc] = useState("");
  const [date, setDate] = useState<string>(todayISO());
  const [tagsInput, setTagsInput] = useState("");
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [viewerOpen, setViewerOpen] = useState(false);
  const initialPhotoRef = useRef<string | null>(null);

  const allTags = useMemo(() => {
    const counts = new Map<string, number>();
    for (const tx of allTransactions) {
      for (const tag of tx.tags || []) {
        counts.set(tag, (counts.get(tag) || 0) + 1);
      }
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([tag]) => tag);
  }, [allTransactions]);

  // Sort categories by recent-frequency: most-used in last 60 days first.
  const sortedCategories = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 60);
    const cutoffIso = cutoff.toISOString().slice(0, 10);
    const counts = new Map<string, number>();
    for (const tx of allTransactions) {
      if (tx.date < cutoffIso) continue;
      counts.set(tx.category, (counts.get(tx.category) || 0) + 1);
    }
    return (current: string[]) =>
      [...current].sort((a, b) => (counts.get(b) || 0) - (counts.get(a) || 0));
  }, [allTransactions]);

  // Top 3 most-recent unique tx signatures (description+amount+category)
  // for quick-fill in new tx mode. Filtered by current `type` so income
  // tab doesn't show expense suggestions and vice versa.
  const recentQuickFill = useMemo(() => {
    const seen = new Set<string>();
    const out: typeof allTransactions = [];
    for (const tx of [...allTransactions].sort(
      (a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id),
    )) {
      if (tx.type !== type) continue;
      const sig = `${tx.category}|${tx.amount}|${tx.description ?? ""}`;
      if (seen.has(sig)) continue;
      seen.add(sig);
      out.push(tx);
      if (out.length >= 3) break;
    }
    return out;
  }, [allTransactions, type]);

  function quickFill(tx: (typeof allTransactions)[0]) {
    setType(tx.type);
    setCategory(tx.category);
    setAmount(inputAmount(tx.amount));
    setDesc(tx.description ?? "");
    setTagsInput((tx.tags || []).join(", "));
    // Date stays today (current default), photo not copied.
  }

  useImperativeHandle(
    ref,
    () => ({
      open(id) {
        if (id) {
          const tx = Store.state.transactions.find((x) => x.id === id);
          if (!tx) return;
          setEditingId(id);
          setType(tx.type);
          setCategory(tx.category);
          setAmount(inputAmount(tx.amount));
          setDesc(tx.description ?? "");
          setDate(tx.date);
          setTagsInput((tx.tags || []).join(", "));
          setPhotoUri(tx.photoUri ?? null);
          initialPhotoRef.current = tx.photoUri ?? null;
        } else {
          setEditingId(null);
          setType("expense");
          setCategory(lastUsed?.expense ?? null);
          setAmount("");
          setDesc("");
          setDate(todayISO());
          setTagsInput("");
          setPhotoUri(null);
          initialPhotoRef.current = null;
        }
        sheet.current?.open();
      },
    }),
    [lastUsed],
  );

  async function attachPhoto(fromCamera: boolean) {
    let ImagePicker: typeof import("expo-image-picker");
    try {
      ImagePicker = require("expo-image-picker");
    } catch {
      Alert.alert(
        "Eksik modül",
        "expo-image-picker kurulu değil. `npx expo install expo-image-picker` çalıştırın.",
      );
      return;
    }
    const perm = fromCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("İzin gerekli", "Foto erişimi verilmedi.");
      return;
    }
    const res = fromCamera
      ? await ImagePicker.launchCameraAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          quality: 0.7,
          allowsEditing: false,
        })
      : await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          quality: 0.7,
          allowsEditing: false,
        });
    if (res.canceled || !res.assets?.[0]?.uri) return;
    const persisted = await persistPhoto(res.assets[0].uri);
    if (!persisted) {
      Alert.alert("Foto kaydedilemedi");
      return;
    }
    if (
      photoUri &&
      photoUri !== initialPhotoRef.current &&
      isLocalPhoto(photoUri)
    ) {
      deletePhoto(photoUri);
    }
    setPhotoUri(persisted);
  }

  function pickPhoto() {
    Alert.alert("Fiş ekle", undefined, [
      { text: "Kamera", onPress: () => attachPhoto(true) },
      { text: "Galeri", onPress: () => attachPhoto(false) },
      { text: "Vazgeç", style: "cancel" },
    ]);
  }

  function clearPhoto() {
    if (
      photoUri &&
      photoUri !== initialPhotoRef.current &&
      isLocalPhoto(photoUri)
    ) {
      deletePhoto(photoUri);
    }
    setPhotoUri(null);
  }

  function changeType(v: TxType) {
    setType(v);
    setCategory(lastUsed?.[v] ?? null);
  }

  function changeDesc(v: string) {
    setDesc(v);
    if (!editingId && !category) {
      const sug = suggestCategory(Store.state, v, type);
      if (sug) setCategory(sug);
    }
  }

  function save() {
    const a = parseAmount(amount);
    if (!a || a <= 0) {
      Alert.alert("Tutar girin");
      return;
    }
    if (!category) {
      Alert.alert("Kategori seçin");
      return;
    }
    const tags = normalizeTags(tagsInput);
    Store.update((s) => {
      if (editingId) {
        const tx = s.transactions.find((x) => x.id === editingId);
        if (tx)
          Object.assign(tx, {
            type,
            category,
            amount: a,
            description: desc.trim(),
            date,
            tags: tags.length ? tags : undefined,
            photoUri: photoUri || null,
          });
      } else {
        s.transactions.push({
          id: uid(),
          type,
          category,
          amount: a,
          description: desc.trim(),
          date,
          tags: tags.length ? tags : undefined,
          photoUri: photoUri || null,
        });
      }
      s.settings.lastUsedCategory = s.settings.lastUsedCategory || {};
      s.settings.lastUsedCategory[type] = category!;
    });
    if (
      initialPhotoRef.current &&
      initialPhotoRef.current !== photoUri &&
      isLocalPhoto(initialPhotoRef.current)
    ) {
      deletePhoto(initialPhotoRef.current);
    }
    initialPhotoRef.current = photoUri;
    notifySuccess();
    sheet.current?.close();
  }

  function remove() {
    if (!editingId) return;
    Alert.alert("Sil", "Bu hareket silinsin mi?", [
      { text: "Vazgeç", style: "cancel" },
      {
        text: "Sil",
        style: "destructive",
        onPress: () => {
          const stored = Store.state.transactions.find(
            (x) => x.id === editingId,
          );
          const storedPhoto = stored?.photoUri ?? null;
          Store.update((s) => {
            s.transactions = s.transactions.filter((x) => x.id !== editingId);
          });
          if (storedPhoto && isLocalPhoto(storedPhoto))
            deletePhoto(storedPhoto);
          if (photoUri && photoUri !== storedPhoto && isLocalPhoto(photoUri)) {
            deletePhoto(photoUri);
          }
          notifyWarning();
          sheet.current?.close();
        },
      },
    ]);
  }

  function addCategory() {
    Alert.prompt?.("Yeni kategori", undefined, (name) => {
      const trimmed = (name || "").trim();
      if (!trimmed || categories[type].includes(trimmed)) return;
      Store.update((s) => s.categories[type].push(trimmed));
      setCategory(trimmed);
    });
  }

  return (
    <Sheet
      ref={sheet}
      title={editingId ? "Hareket" : "Yeni Hareket"}
      actionLabel="Kaydet"
      onAction={save}
    >
      <Segmented<TxType>
        value={type}
        onChange={changeType}
        options={[
          { key: "expense", label: "Gider" },
          { key: "income", label: "Gelir" },
        ]}
      />

      {!editingId && recentQuickFill.length > 0 && (
        <View>
          <FieldLabel>Son Hareketler</FieldLabel>
          <ChipGrid>
            {recentQuickFill.map((rtx) => {
              const name = rtx.description?.trim() || rtx.category;
              const amt = fmtTRY(rtx.amount).replace(/^[-]?₺/, "");
              const label = `${name} · ${amt}₺`;
              return (
                <Chip
                  key={rtx.id}
                  label={label.length > 28 ? label.slice(0, 27) + "…" : label}
                  onPress={() => quickFill(rtx)}
                />
              );
            })}
          </ChipGrid>
        </View>
      )}

      <View>
        <FieldLabel>Tutar</FieldLabel>
        <TextField
          inSheet
          value={amount}
          onChangeText={setAmount}
          keyboardType="decimal-pad"
          placeholder="0"
          autoFocus={!editingId}
          returnKeyType="done"
          onSubmitEditing={save}
        />
      </View>

      <View>
        <FieldLabel>Kategori</FieldLabel>
        <ChipGrid>
          {sortedCategories(categories[type]).map((c) => (
            <Chip
              key={c}
              label={c}
              active={c === category}
              onPress={() => setCategory(c)}
            />
          ))}
          <Chip label="+ Yeni" add onPress={addCategory} />
        </ChipGrid>
      </View>

      <View>
        <FieldLabel>Açıklama</FieldLabel>
        <TextField
          inSheet
          value={desc}
          onChangeText={changeDesc}
          placeholder="Opsiyonel"
        />
      </View>

      <View>
        <FieldLabel>Tarih</FieldLabel>
        <DateField value={date} onChange={(d) => setDate(d || todayISO())} />
      </View>

      <View>
        <FieldLabel>Etiketler</FieldLabel>
        <TextField
          inSheet
          value={tagsInput}
          onChangeText={setTagsInput}
          placeholder="virgülle ayır: iş, seyahat"
          autoCapitalize="none"
        />
        {allTags.length > 0 && (
          <View style={{ marginTop: 8 }}>
            <ChipGrid>
              {allTags.slice(0, 12).map((tag) => {
                const current = tagsInput
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean);
                const active = current.includes(tag);
                return (
                  <Chip
                    key={tag}
                    label={tag}
                    active={active}
                    onPress={() => {
                      const set = new Set(current);
                      if (active) set.delete(tag);
                      else set.add(tag);
                      setTagsInput([...set].join(", "));
                    }}
                  />
                );
              })}
            </ChipGrid>
          </View>
        )}
      </View>

      <View>
        <FieldLabel>Fiş</FieldLabel>
        {photoUri ? (
          <View style={photoStyles.row}>
            <Pressable
              onPress={() => setViewerOpen(true)}
              accessibilityRole="imagebutton"
              accessibilityLabel="Fişi tam ekran aç"
            >
              <Image
                source={{ uri: photoUri }}
                style={photoStyles.thumb}
                contentFit="cover"
                cachePolicy="memory-disk"
                transition={120}
              />
            </Pressable>
            <View style={{ flex: 1, gap: 6 }}>
              <Pressable
                onPress={pickPhoto}
                style={({ pressed }) => [
                  photoStyles.btn,
                  { backgroundColor: t.bg.fill, opacity: pressed ? 0.6 : 1 },
                ]}
              >
                <Text style={{ color: t.tint, fontWeight: "500" }}>
                  Değiştir
                </Text>
              </Pressable>
              <Pressable
                onPress={clearPhoto}
                style={({ pressed }) => [
                  photoStyles.btn,
                  { backgroundColor: t.bg.fill, opacity: pressed ? 0.6 : 1 },
                ]}
              >
                <Text style={{ color: t.red, fontWeight: "500" }}>Kaldır</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <Pressable
            onPress={pickPhoto}
            style={({ pressed }) => [
              photoStyles.btn,
              { backgroundColor: t.bg.fill, opacity: pressed ? 0.6 : 1 },
            ]}
          >
            <Text style={{ color: t.tint, fontWeight: "500" }}>
              Fiş Fotoğrafı Ekle
            </Text>
          </Pressable>
        )}
      </View>

      {editingId && <DestructiveButton label="Hareketi Sil" onPress={remove} />}

      <PhotoViewer
        uri={viewerOpen ? photoUri : null}
        onClose={() => setViewerOpen(false)}
      />
    </Sheet>
  );
});

const photoStyles = StyleSheet.create({
  row: { flexDirection: "row", gap: 12, alignItems: "center" },
  thumb: {
    width: 72,
    height: 72,
    borderRadius: 10,
    backgroundColor: "#0001",
  },
  btn: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    alignItems: "center",
  },
});
