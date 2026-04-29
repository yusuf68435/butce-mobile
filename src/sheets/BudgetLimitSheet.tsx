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
import { ProgressBar, toneFromPct } from "../ui/ProgressBar";
import { TextField } from "../ui/TextField";
import { DestructiveButton } from "../ui/Controls";
import { Store, useStore } from "../store/store";
import { categorySpendOfMonth } from "../store/selectors";
import { categoryMeta } from "../lib/constants";
import {
  currentMonthKey,
  fmtTRY,
  inputAmount,
  parseAmount,
} from "../lib/format";
import { useTheme } from "../theme/tokens";

export interface BudgetLimitSheetRef {
  open: (category?: string | null) => void;
}

export const BudgetLimitSheet = forwardRef<BudgetLimitSheetRef>(
  function BudgetLimitSheet(_, ref) {
    const sheet = useRef<SheetRef>(null);
    const t = useTheme();
    const state = useStore((s) => s);
    const [editing, setEditing] = useState<string | null>(null);
    const [amount, setAmount] = useState("");
    const [picking, setPicking] = useState<string | null>(null);

    useImperativeHandle(
      ref,
      () => ({
        open(cat) {
          if (cat) {
            const existing = (state.settings.budgetLimits || []).find(
              (l) => l.category === cat,
            );
            setEditing(cat);
            setPicking(cat);
            setAmount(existing ? inputAmount(existing.amount) : "");
          } else {
            setEditing(null);
            setPicking(null);
            setAmount("");
          }
          sheet.current?.open();
        },
      }),
      [state.settings.budgetLimits],
    );

    const limits = state.settings.budgetLimits || [];
    const rows = categorySpendOfMonth(state, currentMonthKey());
    const expenseCats = state.categories.expense;
    const limitedSet = new Set(limits.map((l) => l.category));
    const unlimited = expenseCats.filter((c) => !limitedSet.has(c));

    function save() {
      const cat = picking || editing;
      const a = parseAmount(amount);
      if (!cat) {
        Alert.alert("Kategori seçin");
        return;
      }
      if (!a || a <= 0) {
        Alert.alert("Tutar girin");
        return;
      }
      Store.update((s) => {
        const list = s.settings.budgetLimits || [];
        const idx = list.findIndex((l) => l.category === cat);
        if (idx >= 0) list[idx].amount = a;
        else list.push({ category: cat, amount: a });
        s.settings.budgetLimits = list;
      });
      setEditing(null);
      setPicking(null);
      setAmount("");
    }

    function remove(cat: string) {
      Alert.alert("Limiti sil", `${cat} kategorisi limiti kalksın mı?`, [
        { text: "Vazgeç", style: "cancel" },
        {
          text: "Sil",
          style: "destructive",
          onPress: () => {
            Store.update((s) => {
              s.settings.budgetLimits = (s.settings.budgetLimits || []).filter(
                (l) => l.category !== cat,
              );
            });
          },
        },
      ]);
    }

    return (
      <Sheet ref={sheet} title="Bütçe Limitleri" cancelLabel="Kapat">
        <Grouped header={picking ? "Limit Tutarı" : "Yeni Limit"}>
          {!picking ? (
            unlimited.length === 0 ? (
              <RowEmpty>Tüm kategorilere limit tanımlı.</RowEmpty>
            ) : (
              unlimited.map((c, i) => {
                const meta = categoryMeta(c);
                return (
                  <Row
                    key={c}
                    icon={meta.icon}
                    iconColor={meta.color}
                    title={c}
                    chevron
                    onPress={() => setPicking(c)}
                    isFirst={i === 0}
                  />
                );
              })
            )
          ) : (
            <View style={{ padding: 12, gap: 8, backgroundColor: t.bg.elev }}>
              <Text
                style={{
                  fontSize: 15,
                  color: t.label.secondary,
                }}
              >
                {picking}
              </Text>
              <TextField
                inSheet
                value={amount}
                onChangeText={setAmount}
                keyboardType="decimal-pad"
                placeholder="Aylık limit (₺)"
              />
              <View style={{ flexDirection: "row", gap: 8, marginTop: 4 }}>
                <View style={{ flex: 1 }}>
                  <DestructiveButton
                    label="Vazgeç"
                    onPress={() => {
                      setPicking(null);
                      setAmount("");
                    }}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <SaveButton onPress={save} />
                </View>
              </View>
            </View>
          )}
        </Grouped>

        <Grouped header="Mevcut Limitler" footer="Bu ayın gerçekleşen / limit">
          {rows.length === 0 ? (
            <RowEmpty>Henüz limit yok.</RowEmpty>
          ) : (
            rows.map((r, i) => {
              const meta = categoryMeta(r.category);
              const tone = toneFromPct(r.pct);
              return (
                <View key={r.category}>
                  <Row
                    icon={meta.icon}
                    iconColor={meta.color}
                    title={r.category}
                    sub={`${fmtTRY(r.spent)} / ${fmtTRY(r.limit)}`}
                    valueStack={{
                      value: `${Math.round(r.pct)}%`,
                      sub:
                        r.remaining >= 0
                          ? `${fmtTRY(r.remaining)} kaldı`
                          : `${fmtTRY(-r.remaining)} aşıldı`,
                      subTone:
                        tone === "over"
                          ? "neg"
                          : tone === "warn"
                            ? "default"
                            : "muted",
                    }}
                    onPress={() => {
                      setPicking(r.category);
                      setAmount(inputAmount(r.limit));
                    }}
                    isFirst={i === 0}
                  />
                  <View
                    style={{
                      backgroundColor: t.bg.elev,
                      paddingHorizontal: 16,
                      paddingBottom: 10,
                    }}
                  >
                    <ProgressBar pct={r.pct} tone={tone} />
                  </View>
                  <View
                    style={{
                      backgroundColor: t.bg.elev,
                      paddingHorizontal: 16,
                      paddingBottom: 8,
                      alignItems: "flex-end",
                    }}
                  >
                    <Text
                      style={{ color: t.red, fontSize: 13 }}
                      onPress={() => remove(r.category)}
                    >
                      Sil
                    </Text>
                  </View>
                </View>
              );
            })
          )}
        </Grouped>
      </Sheet>
    );
  },
);

function SaveButton({ onPress }: { onPress: () => void }) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Kaydet"
      hitSlop={8}
      style={({ pressed }) => ({
        backgroundColor: t.tint,
        paddingVertical: 13,
        borderRadius: 12,
        alignItems: "center",
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Text
        style={{
          color: "#fff",
          fontSize: 17,
          fontWeight: "600",
          letterSpacing: -0.4,
        }}
      >
        Kaydet
      </Text>
    </Pressable>
  );
}
