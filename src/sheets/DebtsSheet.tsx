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
import { Segmented, FieldLabel, DestructiveButton } from "../ui/Controls";
import { TextField } from "../ui/TextField";
import { DateField } from "../ui/DateField";
import { Store, useStore } from "../store/store";
import { DebtKind } from "../store/types";
import {
  fmtDate,
  fmtTRY,
  inputAmount,
  parseAmount,
  todayISO,
  uid,
} from "../lib/format";

export interface DebtsSheetRef {
  open: (id?: string | null) => void;
}

export const DebtsSheet = forwardRef<DebtsSheetRef>(
  function DebtsSheet(_, ref) {
    const sheet = useRef<SheetRef>(null);
    const debts = useStore((s) => s.debts);

    const [editingId, setEditingId] = useState<string | null>(null);
    const [editing, setEditing] = useState(false);
    const [name, setName] = useState("");
    const [kind, setKind] = useState<DebtKind>("owe");
    const [amount, setAmount] = useState("");
    const [dueDate, setDueDate] = useState<string | null>(null);
    const [note, setNote] = useState("");

    useImperativeHandle(
      ref,
      () => ({
        open(id) {
          if (id) {
            const d = Store.state.debts.find((x) => x.id === id);
            if (!d) return;
            setEditingId(id);
            setEditing(true);
            setName(d.name);
            setKind(d.kind);
            setAmount(inputAmount(d.amount));
            setDueDate(d.dueDate ?? null);
            setNote(d.note ?? "");
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
      setKind("owe");
      setAmount("");
      setDueDate(null);
      setNote("");
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
      Store.update((s) => {
        if (editingId) {
          const d = s.debts.find((x) => x.id === editingId);
          if (d)
            Object.assign(d, {
              name: name.trim(),
              kind,
              amount: a,
              dueDate,
              note: note.trim(),
            });
        } else {
          s.debts.push({
            id: uid(),
            name: name.trim(),
            kind,
            amount: a,
            dueDate,
            note: note.trim(),
            paid: false,
            createdAt: todayISO(),
          });
        }
      });
      resetForm();
      setEditing(false);
    }

    function togglePaid(id: string) {
      Store.update((s) => {
        const d = s.debts.find((x) => x.id === id);
        if (d) d.paid = !d.paid;
      });
    }

    function remove(id: string) {
      Alert.alert("Sil", "Bu kayıt silinsin mi?", [
        { text: "Vazgeç", style: "cancel" },
        {
          text: "Sil",
          style: "destructive",
          onPress: () => {
            Store.update((s) => {
              s.debts = s.debts.filter((d) => d.id !== id);
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
          title={editingId ? "Borcu Düzenle" : "Yeni Borç/Alacak"}
          actionLabel="Kaydet"
          onAction={save}
          cancelLabel="Geri"
          onCancel={() => {
            resetForm();
            setEditing(false);
          }}
        >
          <Segmented<DebtKind>
            value={kind}
            onChange={setKind}
            options={[
              { key: "owe", label: "Borçluyum" },
              { key: "lent", label: "Alacaklıyım" },
            ]}
          />

          <View>
            <FieldLabel>Kişi/Kurum</FieldLabel>
            <TextField
              inSheet
              value={name}
              onChangeText={setName}
              placeholder="Ali, banka…"
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
            <FieldLabel>Vade Tarihi (opsiyonel)</FieldLabel>
            <DateField value={dueDate} onChange={setDueDate} />
          </View>

          <View>
            <FieldLabel>Not</FieldLabel>
            <TextField
              inSheet
              value={note}
              onChangeText={setNote}
              placeholder="Opsiyonel"
            />
          </View>

          {editingId && (
            <DestructiveButton
              label="Kaydı Sil"
              onPress={() => editingId && remove(editingId)}
            />
          )}
        </Sheet>
      );
    }

    const owes = debts.filter((d) => d.kind === "owe" && !d.paid);
    const lent = debts.filter((d) => d.kind === "lent" && !d.paid);
    const paid = debts.filter((d) => d.paid);

    return (
      <Sheet ref={sheet} title="Borç/Alacak" cancelLabel="Kapat">
        {owes.length > 0 && (
          <Grouped header="Borçlarım">
            {owes.map((d, i) => (
              <Row
                key={d.id}
                icon="arrow-down"
                iconColor="red"
                title={d.name}
                sub={d.dueDate ? `Vade ${fmtDate(d.dueDate)}` : "Vadesiz"}
                value={fmtTRY(d.amount)}
                valueTone="neg"
                onPress={() => {
                  setEditingId(d.id);
                  setEditing(true);
                  setName(d.name);
                  setKind(d.kind);
                  setAmount(inputAmount(d.amount));
                  setDueDate(d.dueDate ?? null);
                  setNote(d.note ?? "");
                }}
                swipeActions={[
                  {
                    label: "Sil",
                    tone: "danger",
                    onPress: () => remove(d.id),
                  },
                  {
                    label: "Ödendi",
                    tone: "primary",
                    onPress: () => togglePaid(d.id),
                  },
                ]}
                isFirst={i === 0}
              />
            ))}
          </Grouped>
        )}

        {lent.length > 0 && (
          <Grouped header="Alacaklarım">
            {lent.map((d, i) => (
              <Row
                key={d.id}
                icon="arrow-up"
                iconColor="green"
                title={d.name}
                sub={d.dueDate ? `Vade ${fmtDate(d.dueDate)}` : "Vadesiz"}
                value={fmtTRY(d.amount)}
                valueTone="pos"
                onPress={() => {
                  setEditingId(d.id);
                  setEditing(true);
                  setName(d.name);
                  setKind(d.kind);
                  setAmount(inputAmount(d.amount));
                  setDueDate(d.dueDate ?? null);
                  setNote(d.note ?? "");
                }}
                swipeActions={[
                  {
                    label: "Sil",
                    tone: "danger",
                    onPress: () => remove(d.id),
                  },
                  {
                    label: "Tahsil",
                    tone: "primary",
                    onPress: () => togglePaid(d.id),
                  },
                ]}
                isFirst={i === 0}
              />
            ))}
          </Grouped>
        )}

        {paid.length > 0 && (
          <Grouped header="Kapanmış">
            {paid.map((d, i) => (
              <Row
                key={d.id}
                icon="check"
                iconColor="gray"
                title={d.name}
                sub={d.kind === "owe" ? "Ödendi" : "Tahsil edildi"}
                value={fmtTRY(d.amount)}
                valueTone="muted"
                onPress={() => togglePaid(d.id)}
                isFirst={i === 0}
              />
            ))}
          </Grouped>
        )}

        {owes.length + lent.length + paid.length === 0 && (
          <Grouped>
            <RowEmpty>Henüz kayıt yok.</RowEmpty>
          </Grouped>
        )}

        <Row
          icon="plus"
          iconColor="blue"
          title="Yeni borç/alacak"
          chevron
          onPress={() => {
            resetForm();
            setEditing(true);
          }}
          isFirst
        />
      </Sheet>
    );
  },
);
