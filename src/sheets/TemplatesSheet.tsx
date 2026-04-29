import React, {
  forwardRef,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { Alert, View } from "react-native";
import { Sheet, SheetRef } from "../ui/Sheet";
import { Grouped } from "../ui/Grouped";
import { Row, RowEmpty } from "../ui/Row";
import {
  Chip,
  ChipGrid,
  DestructiveButton,
  FieldLabel,
  Segmented,
} from "../ui/Controls";
import { TextField } from "../ui/TextField";
import { Store, useStore } from "../store/store";
import { TxType } from "../store/types";
import { categoryMeta } from "../lib/constants";
import { fmtTRY, inputAmount, parseAmount, todayISO, uid } from "../lib/format";
import { notifySuccess } from "../lib/haptics";

export interface TemplatesSheetRef {
  open: () => void;
}

export const TemplatesSheet = forwardRef<TemplatesSheetRef>(
  function TemplatesSheet(_, ref) {
    const sheet = useRef<SheetRef>(null);
    const templates = useStore((s) => s.templates);
    const categories = useStore((s) => s.categories);

    const [editing, setEditing] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [name, setName] = useState("");
    const [type, setType] = useState<TxType>("expense");
    const [category, setCategory] = useState<string | null>(null);
    const [amount, setAmount] = useState("");
    const [desc, setDesc] = useState("");

    useImperativeHandle(
      ref,
      () => ({
        open() {
          setEditing(false);
          sheet.current?.open();
        },
      }),
      [],
    );

    function resetForm() {
      setEditingId(null);
      setName("");
      setType("expense");
      setCategory(null);
      setAmount("");
      setDesc("");
    }

    function startEdit(id: string) {
      const tpl = Store.state.templates.find((x) => x.id === id);
      if (!tpl) return;
      setEditingId(id);
      setEditing(true);
      setName(tpl.name);
      setType(tpl.type);
      setCategory(tpl.category);
      setAmount(inputAmount(tpl.amount));
      setDesc(tpl.description ?? "");
    }

    function save() {
      const a = parseAmount(amount);
      if (!name.trim()) {
        Alert.alert("İsim girin");
        return;
      }
      if (!a || a <= 0) {
        Alert.alert("Tutar girin");
        return;
      }
      if (!category) {
        Alert.alert("Kategori seçin");
        return;
      }
      Store.update((s) => {
        if (editingId) {
          const tpl = s.templates.find((x) => x.id === editingId);
          if (tpl)
            Object.assign(tpl, {
              name: name.trim(),
              type,
              category,
              amount: a,
              description: desc.trim() || undefined,
            });
        } else {
          s.templates.push({
            id: uid(),
            name: name.trim(),
            type,
            category,
            amount: a,
            description: desc.trim() || undefined,
          });
        }
      });
      resetForm();
      setEditing(false);
    }

    function remove(id: string) {
      Alert.alert("Sil", "Bu şablon silinsin mi?", [
        { text: "Vazgeç", style: "cancel" },
        {
          text: "Sil",
          style: "destructive",
          onPress: () => {
            Store.update((s) => {
              s.templates = s.templates.filter((t) => t.id !== id);
            });
            if (editingId === id) {
              resetForm();
              setEditing(false);
            }
          },
        },
      ]);
    }

    function applyTemplate(id: string) {
      const tpl = Store.state.templates.find((x) => x.id === id);
      if (!tpl) return;
      Store.update((s) => {
        s.transactions.push({
          id: uid(),
          type: tpl.type,
          category: tpl.category,
          description: tpl.description,
          amount: tpl.amount,
          date: todayISO(),
          tags: tpl.tags,
        });
      });
      notifySuccess();
      sheet.current?.close();
    }

    if (editing) {
      return (
        <Sheet
          ref={sheet}
          title={editingId ? "Şablonu Düzenle" : "Yeni Şablon"}
          actionLabel="Kaydet"
          onAction={save}
          cancelLabel="Geri"
          onCancel={() => {
            resetForm();
            setEditing(false);
          }}
        >
          <Segmented<TxType>
            value={type}
            onChange={setType}
            options={[
              { key: "expense", label: "Gider" },
              { key: "income", label: "Gelir" },
            ]}
          />

          <View>
            <FieldLabel>İsim</FieldLabel>
            <TextField
              inSheet
              value={name}
              onChangeText={setName}
              placeholder="Migros 200₺, kira, …"
            />
          </View>

          <View>
            <FieldLabel>Tutar</FieldLabel>
            <TextField
              inSheet
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
              placeholder="0"
            />
          </View>

          <View>
            <FieldLabel>Kategori</FieldLabel>
            <ChipGrid>
              {categories[type].map((c) => (
                <Chip
                  key={c}
                  label={c}
                  active={c === category}
                  onPress={() => setCategory(c)}
                />
              ))}
            </ChipGrid>
          </View>

          <View>
            <FieldLabel>Açıklama</FieldLabel>
            <TextField
              inSheet
              value={desc}
              onChangeText={setDesc}
              placeholder="Opsiyonel"
            />
          </View>

          {editingId && (
            <DestructiveButton
              label="Şablonu Sil"
              onPress={() => editingId && remove(editingId)}
            />
          )}
        </Sheet>
      );
    }

    return (
      <Sheet ref={sheet} title="Şablonlar" cancelLabel="Kapat">
        <Grouped
          header="Tek Tıkla Ekle"
          footer="Sık kullandığın hareketleri kaydet, anında ekle."
        >
          {templates.length === 0 ? (
            <RowEmpty>Henüz şablon yok.</RowEmpty>
          ) : (
            templates.map((tpl, i) => {
              const meta = categoryMeta(tpl.category);
              const sign = tpl.type === "income" ? "+" : "−";
              return (
                <Row
                  key={tpl.id}
                  icon={meta.icon}
                  iconColor={meta.color}
                  title={tpl.name}
                  sub={tpl.category}
                  value={`${sign}${fmtTRY(tpl.amount).replace("-", "")}`}
                  valueTone={tpl.type === "income" ? "pos" : "default"}
                  onPress={() => applyTemplate(tpl.id)}
                  onLongPress={() => startEdit(tpl.id)}
                  swipeActions={[
                    {
                      label: "Sil",
                      tone: "danger",
                      onPress: () => remove(tpl.id),
                    },
                    {
                      label: "Düzenle",
                      tone: "primary",
                      onPress: () => startEdit(tpl.id),
                    },
                  ]}
                  isFirst={i === 0}
                />
              );
            })
          )}
          <Row
            icon="plus"
            iconColor="blue"
            title="Yeni şablon"
            chevron
            onPress={() => {
              resetForm();
              setEditing(true);
            }}
            isFirst={templates.length === 0}
          />
        </Grouped>
      </Sheet>
    );
  },
);
