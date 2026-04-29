import React, {
  forwardRef,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { Alert, View } from "react-native";
import { Sheet, SheetRef } from "../ui/Sheet";
import { Hero } from "../ui/Hero";
import { Chip, ChipGrid, FieldLabel } from "../ui/Controls";
import { TextField } from "../ui/TextField";
import { DateField } from "../ui/DateField";
import { Store, useStore } from "../store/store";
import { fmtTRY, inputAmount, parseAmount, todayISO, uid } from "../lib/format";

export interface CollectSheetRef {
  open: (id: string) => void;
}

export const CollectSheet = forwardRef<CollectSheetRef>(
  function CollectSheet(_, ref) {
    const sheet = useRef<SheetRef>(null);
    const incomeCats = useStore((s) => s.categories.income);
    const lastUsed = useStore((s) => s.settings.lastUsedCategory?.income);

    const [pendingId, setPendingId] = useState<string | null>(null);
    const [source, setSource] = useState("");
    const [headAmount, setHeadAmount] = useState(0);
    const [amount, setAmount] = useState("");
    const [category, setCategory] = useState<string | null>(null);
    const [date, setDate] = useState<string>(todayISO());

    useImperativeHandle(
      ref,
      () => ({
        open(id) {
          const p = Store.state.pending.find((x) => x.id === id);
          if (!p) return;
          setPendingId(id);
          setSource(p.source);
          setHeadAmount(p.amount);
          setAmount(inputAmount(p.amount));
          setCategory(lastUsed ?? incomeCats[0] ?? null);
          setDate(todayISO());
          sheet.current?.open();
        },
      }),
      [lastUsed, incomeCats],
    );

    function save() {
      if (!pendingId) return;
      const p = Store.state.pending.find((x) => x.id === pendingId);
      if (!p) return;
      const a = parseAmount(amount);
      if (!a || a <= 0) {
        Alert.alert("Tutar girin");
        return;
      }
      if (!category) {
        Alert.alert("Kategori seçin");
        return;
      }
      Store.update((s) => {
        s.transactions.push({
          id: uid(),
          type: "income",
          category: category!,
          description: p.source,
          amount: a,
          date,
        });
        s.pending = s.pending.filter((x) => x.id !== pendingId);
        s.settings.lastUsedCategory = s.settings.lastUsedCategory || {};
        s.settings.lastUsedCategory.income = category!;
      });
      sheet.current?.close();
    }

    return (
      <Sheet
        ref={sheet}
        title="Tahsilat Geldi"
        actionLabel="Aktar"
        onAction={save}
      >
        <Hero eyebrow={source} amount={fmtTRY(headAmount)} compact />

        <View>
          <FieldLabel>Tutar</FieldLabel>
          <TextField
            inSheet
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
          />
        </View>

        <View>
          <FieldLabel>Gelir Kategorisi</FieldLabel>
          <ChipGrid>
            {incomeCats.map((c) => (
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
          <FieldLabel>Tarih</FieldLabel>
          <DateField value={date} onChange={(d) => setDate(d || todayISO())} />
        </View>
      </Sheet>
    );
  },
);
