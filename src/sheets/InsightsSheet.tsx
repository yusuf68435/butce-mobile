import React, { forwardRef, useImperativeHandle, useMemo, useRef } from "react";
import { Sheet, SheetRef } from "../ui/Sheet";
import { Grouped } from "../ui/Grouped";
import { Row, RowEmpty } from "../ui/Row";
import { useStore } from "../store/store";
import { anomalies, cashflowForecast, deriveInsights } from "../lib/insights";
import { merchantSpending, tagSpending } from "../store/selectors";
import { categoryMeta } from "../lib/constants";
import { currentMonthKey, fmtDate, fmtTRY } from "../lib/format";

export interface InsightsSheetRef {
  open: () => void;
}

export const InsightsSheet = forwardRef<InsightsSheetRef>(
  function InsightsSheet(_, ref) {
    const sheet = useRef<SheetRef>(null);
    const state = useStore((s) => s);

    useImperativeHandle(
      ref,
      () => ({
        open() {
          sheet.current?.open();
        },
      }),
      [],
    );

    const insights = useMemo(() => deriveInsights(state), [state]);
    const forecast = useMemo(() => cashflowForecast(state, 30), [state]);
    const anom = useMemo(() => anomalies(state), [state]);
    const tags = useMemo(
      () => tagSpending(state, currentMonthKey()).slice(0, 6),
      [state],
    );
    const merchants = useMemo(
      () => merchantSpending(state, currentMonthKey(), 5),
      [state],
    );

    return (
      <Sheet ref={sheet} title="Akıllı Özet" cancelLabel="Kapat">
        <Grouped header="Bu Ayın Çıkarımları">
          {insights.length === 0 ? (
            <RowEmpty>Henüz yeterli veri yok.</RowEmpty>
          ) : (
            insights.map((ins, i) => (
              <Row
                key={ins.id}
                icon={ins.icon}
                iconColor={ins.iconColor}
                title={ins.title}
                sub={ins.detail}
                isFirst={i === 0}
              />
            ))
          )}
        </Grouped>

        <Grouped header="30 Günlük Tahmin" footer="Son 3 ay ortalamasına göre">
          <Row
            title="Tahmini Bakiye"
            sub="Bugünden 30 gün sonra"
            value={fmtTRY(forecast.projected)}
            valueTone={forecast.projected >= 0 ? "pos" : "neg"}
            valueBold
            isFirst
          />
          <Row
            title="Aylık Ortalama Gelir"
            value={fmtTRY(forecast.inflowMonthly)}
            valueTone="pos"
          />
          <Row
            title="Aylık Ortalama Gider"
            value={fmtTRY(forecast.outflowMonthly)}
            valueTone="neg"
          />
          <Row
            title="Düzenli Net"
            sub="Aboneliklerden"
            value={fmtTRY(forecast.recurringNet)}
            valueTone={forecast.recurringNet >= 0 ? "pos" : "neg"}
          />
        </Grouped>

        {merchants.length > 0 && (
          <Grouped
            header="En Çok Harcanan"
            footer="Açıklamadan otomatik çıkarıldı"
          >
            {merchants.map((m, i) => (
              <Row
                key={m.merchant}
                icon="cart"
                iconColor="orange"
                title={m.merchant}
                sub={`${m.count} hareket`}
                value={fmtTRY(m.amount)}
                valueTone="neg"
                isFirst={i === 0}
              />
            ))}
          </Grouped>
        )}

        {tags.length > 0 && (
          <Grouped
            header="Etiket Dağılımı"
            footer="Bu ay, gider toplamına göre"
          >
            {tags.map((t, i) => (
              <Row
                key={t.tag}
                icon="tag"
                iconColor="purple"
                title={t.tag}
                sub={`${t.count} hareket`}
                value={fmtTRY(t.amount)}
                valueTone="neg"
                isFirst={i === 0}
              />
            ))}
          </Grouped>
        )}

        {anom.length > 0 && (
          <Grouped
            header="Sıra Dışı Harcamalar"
            footer="Son 90 gün, kategori medyanına göre"
          >
            {anom.map((a, i) => {
              const meta = categoryMeta(a.category);
              return (
                <Row
                  key={a.id}
                  icon={meta.icon}
                  iconColor={meta.color}
                  title={a.category}
                  sub={`${a.description ? a.description + " · " : ""}${fmtDate(a.date)} · medyan ${fmtTRY(a.median)}`}
                  value={fmtTRY(a.amount)}
                  valueTone="neg"
                  isFirst={i === 0}
                />
              );
            })}
          </Grouped>
        )}
      </Sheet>
    );
  },
);
