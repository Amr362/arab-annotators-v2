# Arab Annotators v5 — Smart Distribution System
# نظام التوزيع الذكي للمهام

---

## الملفات الجديدة

```
supabase/
  schema-distribution.sql    ← جداول + فانكشنز + RLS للتوزيع

lib/
  distributor.js             ← خوارزمية التوزيع (pure JS، قابل للاختبار)

pages/api/admin/
  create-tasks.js            ← POST: رفع مهام بالجملة + توزيع فوري
  reassign.js                ← POST: إعادة توزيع مهام المشغلين المعطّلين
  distribution-stats.js      ← GET: analytics التوزيع

pages/api/worker/
  my-tasks.js                ← GET: طابور مهام المشغّل (paginated)
  next-task.js               ← GET: سحب المهمة التالية (atomic lock)

pages/api/task/
  complete.js                ← POST: إكمال مهمة + حفظ الإجابة

pages/admin/
  bulk-upload.js             ← واجهة رفع المهام بالجملة
  distribution.js            ← analytics لوحة التوزيع

pages/tasks/
  queue.js                   ← طابور المشغّل الشخصي
```

---

## خطوات التثبيت

### 1. تشغيل الـ SQL
في Supabase SQL Editor، شغّل بالترتيب:
```
supabase/schema.sql
supabase/schema-distribution.sql
```

### 2. المتغيرات المطلوبة
```env
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
SETUP_SECRET_KEY=...
```

### 3. Seed المستخدمين
```
POST /api/users/seed
Body: { "setupKey": "SETUP_SECRET_KEY_VALUE" }
```

---

## كيفية الاستخدام

### رفع مهام (Admin):
```js
// POST /api/admin/create-tasks
{
  tasks: [
    {
      proverb: "الصبر مفتاح الفرج",
      context_sentences: [
        "صبر على المصاعب حتى نال مراده",
        "قيل إن الصبر مفتاح الفرج لكل مؤمن",
        "لا تيأس فالصبر مفتاح الفرج"
      ]
    }
    // ... حتى 10,000 مهمة
  ],
  shuffle: false  // true = ترتيب عشوائي
}

// Response:
{
  batch_id: "uuid",
  total_tasks: 100,
  total_workers: 10,
  tasks_per_worker: 10,
  distribution: [
    { worker_id: "...", worker_name: "أحمد", count: 10 },
    ...
  ]
}
```

### جلب مهام المشغّل:
```js
// GET /api/worker/my-tasks?status=pending&limit=25&offset=0
{
  tasks: [...],
  queue_stats: { total: 50, pending: 40, in_progress: 1, completed: 9 },
  pagination: { limit: 25, offset: 0, total: 50, has_more: true }
}
```

### سحب المهمة التالية:
```js
// GET /api/worker/next-task
{ task: { assignment_id, task_id, proverb, context_sentences, queue_position } }
// أو إذا الطابور فارغ:
{ task: null, message: "طابور المهام فارغ" }
```

### إكمال مهمة:
```js
// POST /api/task/complete
{
  assignment_id: "uuid",
  task_id: "uuid",
  response_1: "الجملة الأولى",
  response_2: "الجملة الثانية",
  response_3: "الجملة الثالثة",
  notes: "ملاحظة اختيارية"
}
```

### إعادة توزيع المعطّلة:
```js
// POST /api/admin/reassign
{ inactive_hours: 24 }

// Response:
{
  reassigned_count: 15,
  from_workers: 2,
  to_workers: 8,
  details: [{ task_id, from_worker: "علي", to_worker: "أحمد" }]
}
```

---

## الخوارزمية — شرح مفصّل

```
الإدخال:   100 مهمة، 10 مشغلين
الأساس:    floor(100/10) = 10 مهمة لكل مشغل
الباقي:    100 % 10 = 0 (متساوٍ تماماً)

مثال غير متساوٍ:
الإدخال:   103 مهمة، 10 مشغلين
الأساس:    floor(103/10) = 10
الباقي:    103 % 10 = 3
النتيجة:   المشغلون 1-3 يحصلون على 11 مهمة
           المشغلون 4-10 يحصلون على 10 مهام
           المجموع: 3×11 + 7×10 = 103 ✓

ترتيب التوزيع:
- يُرتَّب المشغلون حسب العبء الحالي (تصاعدياً)
- الأقل عبئاً يحصل على المهام أولاً
- هذا يضمن التوازن حتى مع مهام سابقة
```

---

## الأداء عند 10,000+ مهمة

### مشاكل محتملة والحلول:

**1. وقت الرفع (Request Timeout)**
```
المشكلة: رفع 10k مهمة قد يستغرق > 30 ثانية
الحل:    chunk inserts (500 صف في كل batch)
         vercel.json → "maxDuration": 60
```

**2. ذاكرة الـ API Route**
```
المشكلة: JSON ضخم يستهلك ذاكرة Node.js
الحل:    bodyParser sizeLimit = "10mb"
         معالجة chunks بدلاً من كل الـ array دفعة واحدة
```

**3. N+1 Queries**
```
المشكلة: جلب worker_id لكل مهمة على حدة
الحل:    جلب كل workerIds دفعة واحدة
         استخدام .in() بدلاً من حلقات
```

**4. Race Conditions**
```
المشكلة: مشغّلان يسحبان نفس المهمة
الحل:    FOR UPDATE SKIP LOCKED في PostgreSQL
         (مُنفَّذ في get_next_task_for_worker())
```

**5. Indexes مهمة للأداء**
```sql
-- الأهم للـ queue:
idx_ta_worker_status (worker_id, status)
idx_ta_queue_pos (worker_id, queue_position)

-- للقفل:
idx_ta_locked_at (locked_at) WHERE locked_at IS NOT NULL
```

### للمشاريع الكبيرة (100k+ مهمة):

```
1. فصل الـ distribution إلى background job (Supabase Edge Functions)
2. استخدام pg_partitioning على task_assignments حسب التاريخ
3. Redis لتخزين worker queue state
4. Webhook بدلاً من polling لإشعار المشغلين
```

---

## RLS Security Summary

| الجدول | المشغّل | QA | Admin |
|--------|---------|-----|-------|
| task_assignments | يرى مهامه فقط | يرى الكل | يرى + يعدّل |
| worker_queues | يرى queue الخاص | — | يرى الكل |
| distribution_batches | — | — | يرى الكل |

**⚠️ الـ assignment يحدث دائماً عبر SUPABASE_SERVICE_ROLE_KEY في API routes**
**لا يوجد أي assignment منطق في الـ frontend أو عبر anon key**
