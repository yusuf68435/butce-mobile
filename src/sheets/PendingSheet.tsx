import React, {
  forwardRef,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { Alert, View } from "react-native";
import { Sheet, SheetRef } from "../ui/Sheet";
import { Chip, ChipGrid, FieldLabel, DestructiveButton } from "../ui/Controls";
import { TextField } from "../ui/TextField";
import { DateField } from "../ui/DateField";
import { Store } from "../store/store";
import { ETA_OPTIONS, PendingEta } from "../lib/constants";
import { inputAmount, parseAmount, todayISO, uid } from "../lib/format";

export interface PendingSheetRef {
  open: (id?: string | null) => void;
}

export const PendingSheet = forwardRef<PendingSheetRef>(
  function PendingSheet(_, ref) {
    const sheet = useRef<SheetRef>(null);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [source, setSource] = useState("");
    const [amount, setAmount] = useState("");
    const [eta, setEta] = useState<PendingEta>("unknown");
    const [date, setDate] = useState<string | null>(null);

    useImperativeHandle(
      ref,
      () => ({
        open(id) {
          if (id) {
            const p = Store.state.pending.find((x) => x.id === id);
            if (!p) return;
            setEditingId(id);
            setSource(p.source);
            setAmount(inputAmount(p.amount));
            setEta(p.eta || "unknown");
            setDate(p.exactDate || null);
          } else {
            setEditingId(null);
            setSource("");
            setAmount("");
            setEta("unknown");
            setDate(null);
          }
          sheet.current?.open();
        },
      }),
      [],
    );

    function save() {
      const s = source.trim();
      const a = parseAmount(amount);
      if (!s) {
        Alert.alert("Kaynak girin");
        return;
      }
      if (!a || a <= 0) {
        Alert.alert("Tutar girin");
        return;
      }
      Store.update((st) => {
        if (editingId) {
          const p = st.pending.find((x) => x.id === editingId);
          if (p)
            Object.assign(p, { source: s, amount: a, eta, exactDate: date });
        } else {
          st.pending.push({
            id: uid(),
            source: s,
            amount: a,
            eta,
            exactDate: date,
            createdAt: todayISO(),
          });
        }
      });
      sheet.current?.close();
    }

    function remove() {
      if (!editingId) return;
      Alert.alert("Sil", "Bu bekleyen kayıt silinsin mi?", [
        { text: "Vazgeç", style: "cancel" },
        {
          text: "Sil",
          style: "destructive",
          onPress: () => {
            Store.update((s) => {
              s.pending = s.pending.filter((p) => p.id !== editingId);
            });
            sheet.current?.close();
          },
        },
      ]);
    }

    return (
      <Sheet
        ref={sheet}
        title={editingId ? "Bekleyen" : "Yeni Bekleyen"}
        actionLabel="Kaydet"
        onAction={save}
      >
        <View>
          <FieldLabel>Kimden / Ne için</FieldLabel>
          <TextField
            inSheet
            value={source}
            onChangeText={setSource}
            placeholder="Örn. UYART projesi"
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
          <FieldLabel>Zaman Tahmini</FieldLabel>
          <ChipGrid>
            {ETA_OPTIONS.map((o) => (
              <Chip
                key={o.key}
                label={o.label}
                active={o.key === eta}
                onPress={() => setEta(o.key)}
              />
            ))}
          </ChipGrid>
        </View>

        <View>
          <FieldLabel>Kesin Tarih (opsiyonel)</FieldLabel>
          <DateField value={date} onChange={setDate} clearable />
        </View>

        {editingId && (
          <DestructiveButton label="Bekleyeni Sil" onPress={remove} />
        )}
      </Sheet>
    );
  },
);
