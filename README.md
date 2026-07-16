# software-catalog

הקטלוג של התוכנות שמוצג ב-[abaye.co/software](https://abaye.co/software).

**כדי לעדכן את האתר — עורכים כאן את `catalog.json`. לא צריך לגעת בקוד של האתר.**
תוך כמה דקות השינוי באוויר.

---

## איך זה עובד

```
catalog.json  ──(GitHub Action)──►  catalog.generated.json  ──(raw CDN)──►  abaye.co/software
   ידני                 מוסיף כוכבים                אוטומטי
                        והורדות
```

1. אתה עורך את `catalog.json` (אפשר ישירות בממשק הווב של גיטהאב).
2. Action רץ אוטומטית ומייצר `catalog.generated.json` — אותו קטלוג, בתוספת כוכבים, הורדות, והנכסים של הריליס האחרון.
3. האתר מושך את הקובץ המיוצר מ-`raw.githubusercontent.com` — **בקשה אחת בלבד**.

**למה זה בנוי כך:** ה-API של גיטהאב מגביל קוראים לא-מאומתים ל-60 בקשות לשעה **לכל IP**. אם האתר היה מושך את הנתונים ישירות מהדפדפן, כל מבקר היה צורך ~10 בקשות, וגולשים שחולקים כתובת (רשתות סלולר, משרדים) היו שורפים את המכסה במשותף ומקבלים 403. כאן ה-Action עושה את זה פעם אחת עם `GITHUB_TOKEN` — 5,000 בקשות לשעה — ו-`raw` הוא CDN שלא מוגבל בכלל.

ה-Action רץ על כל שינוי ב-`catalog.json`, וגם כל 6 שעות כדי לקלוט כוכבים והורדות חדשים.

---

## מבנה `catalog.json`

### תוכנה חינמית עם ריפו

הכוכבים, ההורדות וכפתור ההורדה נוצרים אוטומטית — אל תכתוב אותם ידנית.

```json
{
  "id": "taplingo",
  "repo": "TapLingo",
  "name": { "he": "TapLingo", "en": "TapLingo" },
  "description": {
    "he": "תרגום מהיר של כל טקסט על המסך ב-Windows 11",
    "en": "Instant on-screen translation for Windows 11"
  },
  "tech": ["C#", "WinUI 3"],
  "pricing": "free",
  "page": "https://abaye123.github.io/TapLingo/"
}
```

### תוכנה בתשלום

לא חייבת `repo` — מוצר סגור פשוט לא יציג כוכבים והורדות.

```json
{
  "id": "my-crm",
  "name": { "he": "מערכת ניהול לקוחות", "en": "CRM System" },
  "description": {
    "he": "מערכת CRM מלאה עם דשבורד, ניהול לידים ודוחות",
    "en": "A full CRM with dashboard, lead management and reports"
  },
  "tech": ["Vue", "Node.js", "PostgreSQL"],
  "pricing": "paid",
  "price": { "amount": 250, "currency": "ILS", "period": "one-time" },
  "buy": { "email": "a@abaye.co" }
}
```

### כל השדות

| שדה | חובה | מה זה |
|---|---|---|
| `id` | ✅ | מזהה ייחודי, kebab-case. משמש כמפתח — אל תשנה אותו אחרי פרסום |
| `name` | ✅ | `{ he, en }` |
| `description` | ✅ | `{ he, en }`. משפט אחד, בלי נקודה בסוף |
| `pricing` | ✅ | `"free"` או `"paid"` |
| `repo` | | שם הריפו תחת `abaye123`. נוכחותו היא מה שמפעיל כוכבים/הורדות/הורדה ישירה |
| `tech` | | מערך מחרוזות. מוצג כתגיות |
| `page` | | דף נחיתה ייעודי. לחיצה על שם התוכנה תוביל לשם; אחרת לריפו |
| `hasRelease` | | `false` בלבד, כשאין ריליס כלל — מונע כפתור הורדה שיוביל ל-404 |
| `price` | | `{ amount, currency, period }`. `period`: `"one-time"` \| `"monthly"` \| `"yearly"` |
| `buy.email` | | כתובת לפנייה. האתר בונה מייל עם נושא וגוף מוכנים |
| `order` | | מספר. קובע סדר תצוגה; בלעדיו נשמר סדר הקובץ |

---

## אחרי עריכה

- ה-Action ירוץ מעצמו. אפשר לעקוב בלשונית **Actions**.
- אם יש שגיאת JSON, ה-Action ייכשל **והאתר ימשיך להציג את הגרסה הקודמת** — קובץ שבור לא מגיע לאוויר.
- להרצה ידנית: Actions → Enrich catalog → Run workflow.

### הרצה מקומית

```bash
node scripts/enrich.mjs
```

בלי טוקן זה עובד, אבל מוגבל ל-60 בקשות לשעה. עם טוקן:

```bash
GITHUB_TOKEN=ghp_xxx node scripts/enrich.mjs
```

---

## מה לא לערוך

`catalog.generated.json` נוצר אוטומטית. כל שינוי ידני בו יידרס בהרצה הבאה.
