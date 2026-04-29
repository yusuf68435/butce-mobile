import React, {
  forwardRef,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { Alert, Pressable, Text, View } from "react-native";
import { Sheet, SheetRef } from "../ui/Sheet";
import { Grouped } from "../ui/Grouped";
import { Row, RowEmpty } from "../ui/Row";
import { ProgressBar } from "../ui/ProgressBar";
import { FieldLabel, DestructiveButton } from "../ui/Controls";
import { TextField } from "../ui/TextField";
import { DateField } from "../ui/DateField";
import { useTheme } from "../theme/tokens";
import { Store, useStore } from "../store/store";
import { notifySuccess } from "../lib/haptics";
import {
  fmtDate,
  fmtTRY,
  inputAmount,
  parseAmount,
  todayISO,
  uid,
} from "../lib/format";

export interface GoalSheetRef {
  open: (id?: string | null) => void;
}

export const GoalSheet = forwardRef<GoalSheetRef>(function GoalSheet(_, ref) {
  const sheet = useRef<SheetRef>(null);
  const t = useTheme();
  const goals = useStore((s) => s.goals);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [target, setTarget] = useState("");
  const [saved, setSaved] = useState("");
  const [deadline, setDeadline] = useState<string | null>(null);

  useImperativeHandle(
    ref,
    () => ({
      open(id) {
        if (id) {
          const g = Store.state.goals.find((x) => x.id === id);
          if (!g) return;
          setEditingId(id);
          setEditing(true);
          setName(g.name);
          setTarget(inputAmount(g.target));
          setSaved(inputAmount(g.saved));
          setDeadline(g.deadline ?? null);
        } else {
          resetForm();
          setEditing(false);
        }
        sheet.current?.open();
      },
    }),
    [],
  );

  function resetForm() {
    setEditingId(null);
    setName("");
    setTarget("");
    setSaved("");
    setDeadline(null);
  }

  function save() {
    const tgt = parseAmount(target);
    const sav = parseAmount(saved);
    if (!name.trim()) {
      Alert.alert("İsim girin");
      return;
    }
    if (!tgt || tgt <= 0) {
      Alert.alert("Hedef tutar girin");
      return;
    }
    Store.update((s) => {
      if (editingId) {
        const g = s.goals.find((x) => x.id === editingId);
        if (g)
          Object.assign(g, {
            name: name.trim(),
            target: tgt,
            saved: sav,
            deadline,
          });
      } else {
        s.goals.push({
          id: uid(),
          name: name.trim(),
          target: tgt,
          saved: sav,
          deadline,
          createdAt: todayISO(),
        });
      }
    });
    resetForm();
    setEditing(false);
  }

  function deposit(id: string) {
    Alert.prompt?.("Hedefe ekle", "Tutar (₺)", (v) => {
      const a = parseAmount(v ?? "");
      if (!a || a <= 0) return;
      let justCompleted: { name: string } | null = null;
      Store.update((s) => {
        const g = s.goals.find((x) => x.id === id);
        if (!g) return;
        const wasIncomplete = g.saved < g.target;
        g.saved = (g.saved || 0) + a;
        if (wasIncomplete && g.saved >= g.target && !g.celebratedAt) {
          g.celebratedAt = new Date().toISOString();
          justCompleted = { name: g.name };
        }
      });
      if (justCompleted) {
        notifySuccess();
        Alert.alert(
          "🎉 Hedefe ulaştın!",
          `${(justCompleted as { name: string }).name} tamamlandı.`,
        );
      }
    });
  }

  function remove(id: string) {
    Alert.alert("Sil", "Bu hedef silinsin mi?", [
      { text: "Vazgeç", style: "cancel" },
      {
        text: "Sil",
        style: "destructive",
        onPress: () => {
          Store.update((s) => {
            s.goals = s.goals.filter((g) => g.id !== id);
          });
          if (editingId === id) {
            resetForm();
            setEditing(false);
          }
        },
      },
    ]);
  }

  if (editing) {
    return (
      <Sheet
        ref={sheet}
        title={editingId ? "Hedefi Düzenle" : "Yeni Hedef"}
        actionLabel="Kaydet"
        onAction={save}
        cancelLabel="Geri"
        onCancel={() => {
          resetForm();
          setEditing(false);
        }}
      >
        <View>
          <FieldLabel>İsim</FieldLabel>
          <TextField
            inSheet
            value={name}
            onChangeText={setName}
            placeholder="Tatil, ev, araba…"
          />
        </View>

        <View>
          <FieldLabel>Hedef Tutar</FieldLabel>
          <TextField
            inSheet
            value={target}
            onChangeText={setTarget}
            keyboardType="decimal-pad"
            placeholder="0"
          />
        </View>

        <View>
          <FieldLabel>Şu Ana Kadar Birikmiş</FieldLabel>
          <TextField
            inSheet
            value={saved}
            onChangeText={setSaved}
            keyboardType="decimal-pad"
            placeholder="0"
          />
        </View>

        <View>
          <FieldLabel>Son Tarih (opsiyonel)</FieldLabel>
          <DateField value={deadline} onChange={setDeadline} />
        </View>

        {editingId && (
          <DestructiveButton
            label="Hedefi Sil"
            onPress={() => editingId && remove(editingId)}
          />
        )}
      </Sheet>
    );
  }

  return (
    <Sheet ref={sheet} title="Hedefler" cancelLabel="Kapat">
      <Grouped header="Birikim Hedefleri">
        {goals.length === 0 ? (
          <RowEmpty>Henüz hedef yok.</RowEmpty>
        ) : (
          goals.map((g, i) => {
            const pct = g.target > 0 ? (g.saved / g.target) * 100 : 0;
            const remaining = Math.max(0, g.target - g.saved);
            const sub = g.deadline
              ? `${fmtDate(g.deadline)} · ${fmtTRY(remaining)} kaldı`
              : `${fmtTRY(remaining)} kaldı`;
            return (
              <View key={g.id}>
                <Row
                  title={g.name}
                  sub={sub}
                  valueStack={{
                    value: `${Math.round(Math.min(pct, 999))}%`,
                    sub: `${fmtTRY(g.saved)} / ${fmtTRY(g.target)}`,
                    subTone: "muted",
                  }}
                  onPress={() => {
                    setEditingId(g.id);
                    setEditing(true);
                    setName(g.name);
                    setTarget(inputAmount(g.target));
                    setSaved(inputAmount(g.saved));
                    setDeadline(g.deadline ?? null);
                  }}
                  swipeActions={[
                    {
                      label: "Sil",
                      tone: "danger",
                      onPress: () => remove(g.id),
                    },
                    {
                      label: "Ekle",
                      tone: "primary",
                      onPress: () => deposit(g.id),
                    },
                  ]}
                  isFirst={i === 0}
                />
                <View
                  style={{
                    backgroundColor: t.bg.elev,
                    paddingHorizontal: 16,
                    paddingBottom: 10,
                  }}
                >
                  <ProgressBar
                    pct={pct}
                    tone={pct >= 100 ? "good" : "default"}
                  />
                </View>
                <View
                  style={{
                    backgroundColor: t.bg.elev,
                    paddingHorizontal: 16,
                    paddingBottom: 10,
                    flexDirection: "row",
                    justifyContent: "flex-end",
                    gap: 16,
                  }}
                >
                  <Pressable onPress={() => deposit(g.id)} hitSlop={8}>
                    <Text
                      style={{
                        color: t.tint,
                        fontSize: 14,
                        fontWeight: "500",
                      }}
                    >
                      + Ekle
                    </Text>
                  </Pressable>
                </View>
              </View>
            );
          })
        )}
        <Row
          icon="plus"
          iconColor="blue"
          title="Yeni hedef"
          chevron
          onPress={() => {
            resetForm();
            setEditing(true);
          }}
          isFirst={goals.length === 0}
        />
      </Grouped>
    </Sheet>
  );
});
