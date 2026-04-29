// Tek-kullanıcı (Personal Edition) için TR-only mini sözlük.
// Eski API (`t("key")`, `setLocale`, `initLocale`, `getLocale`) korunur ki
// çağrı yerleri bozulmasın; ancak tüm değerler TR sabitlerinden gelir.

export type Locale = "tr";

const TR: Record<string, string> = {
  // common
  "common.cancel": "Vazgeç",
  "common.close": "Kapat",
  "common.save": "Kaydet",
  "common.delete": "Sil",
  "common.edit": "Düzenle",
  "common.add": "Ekle",
  "common.ok": "Tamam",
  "common.skip": "Atla",
  "common.continue": "Devam",
  "common.notNow": "Şimdi değil",
  "common.error": "Hata",
  "common.success": "Başarılı",
  "common.allTime": "Tümü",

  // hero
  "hero.balance": "Bu Ay Bakiye",
  "hero.pending": "Bekleyen Toplam",

  // sections
  "section.wealth": "Toplam Servet",
  "section.expenseBreakdown": "Gider Dağılımı",
  "section.transactions": "Hareketler",
  "section.budgets": "Bütçe Limitleri",
  "section.recurring": "Abonelikler ve Düzenli Ödemeler",
  "section.goals": "Birikim Hedefleri",
  "section.assets": "Tüm Varlıklar",
  "section.livePrices": "Canlı Fiyat",
  "section.calc": "Para Çevir",

  // tx
  "tx.new": "Yeni Hareket",
  "tx.edit": "Hareket",
  "tx.amount": "Tutar",
  "tx.category": "Kategori",
  "tx.description": "Açıklama",
  "tx.date": "Tarih",
  "tx.tags": "Etiketler",
  "tx.receipt": "Fiş",
  "tx.income": "Gelir",
  "tx.expense": "Gider",
  "tx.empty": "Bu ay hareket yok.",
  "tx.confirmDelete": "Bu hareket silinsin mi?",

  // onboarding
  "onb.welcomeTitle": "Bütçe'ye Hoşgeldin",
  "onb.welcomeBody":
    "Tüm verin cihazında kalır. Sunucu yok, hesap yok, takip yok.",
  "onb.openingTitle": "Açılış bakiyesi",
  "onb.openingBody":
    "Banka veya cüzdandaki güncel TL miktarın. Sonra istediğin zaman düzeltebilirsin.",
  "onb.notifsTitle": "Hatırlatıcı",
  "onb.notifsBody":
    "Aboneliklerin günü gelince bildirim gönderelim mi? İstediğin zaman ayarlardan değiştirebilirsin.",
  "onb.enableNotifs": "Bildirimleri Aç",
};

let current: Locale = "tr";

export function setLocale(_loc: Locale) {
  current = "tr";
}

export function getLocale(): Locale {
  return current;
}

export function initLocale(): Locale {
  current = "tr";
  return current;
}

export function t(key: string): string {
  return TR[key] ?? key;
}
