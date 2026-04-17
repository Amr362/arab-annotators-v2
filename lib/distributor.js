/**
 * Arab Annotators — Smart Task Distribution Algorithm
 * lib/distributor.js
 *
 * Pure JS module. No Supabase imports. Fully testable in isolation.
 *
 * Algorithm: Balanced Round-Robin with Workload-Aware Sorting
 *
 * Step 1: Sort workers by current workload (ascending) — least loaded gets first tasks
 * Step 2: Calculate base allocation = floor(tasks / workers)
 * Step 3: Calculate remainder = tasks % workers
 * Step 4: First `remainder` workers get one extra task
 * Step 5: Assign in round-robin across sorted workers
 * Step 6: Set queue_position for each worker (1-based, ordered)
 *
 * Example: 103 tasks, 10 workers
 *   base = 10, remainder = 3
 *   workers 1,2,3 → 11 tasks each
 *   workers 4-10  → 10 tasks each
 *   Total: 3×11 + 7×10 = 33 + 70 = 103 ✓
 */

/**
 * Calculate balanced task distribution.
 *
 * @param {Array<{id: string, current_load: number}>} workers
 *   Active workers with their current task counts.
 * @param {Array<string>} taskIds
 *   Array of task UUIDs to distribute.
 *
 * @returns {{
 *   assignments: Array<{task_id, worker_id, queue_position}>,
 *   stats: {
 *     total_tasks, total_workers, base_per_worker, remainder,
 *     distribution: Array<{worker_id, count, queue_start, queue_end}>
 *   }
 * }}
 */
export function calculateDistribution(workers, taskIds) {
  if (!workers?.length) throw new Error('No active workers available')
  if (!taskIds?.length) throw new Error('No tasks to distribute')

  const T = taskIds.length
  const W = workers.length

  // Sort by workload: least loaded first
  const sorted = [...workers].sort((a, b) => (a.current_load || 0) - (b.current_load || 0))

  const base = Math.floor(T / W)      // every worker gets at least this many
  const remainder = T % W             // first N workers get one extra

  // Per-worker allocation array: [11, 11, 11, 10, 10, 10, 10, 10, 10, 10]
  const allocations = sorted.map((w, i) => ({
    worker_id: w.id,
    count: base + (i < remainder ? 1 : 0),
    current_load: w.current_load || 0,
  }))

  // Build assignment list with queue positions
  const assignments = []
  let taskIdx = 0

  for (const alloc of allocations) {
    // Track queue positions per worker (separate counters)
    let queuePos = (alloc.current_load || 0) + 1  // start after existing tasks

    for (let i = 0; i < alloc.count; i++) {
      assignments.push({
        task_id: taskIds[taskIdx++],
        worker_id: alloc.worker_id,
        queue_position: queuePos++,
        status: 'pending',
        assigned_at: new Date().toISOString(),
      })
    }
  }

  // Build distribution stats for reporting
  let qPos = 1
  const distribution = allocations.map(a => {
    const start = qPos
    qPos += a.count
    return {
      worker_id: a.worker_id,
      count: a.count,
      queue_start: start,
      queue_end: qPos - 1,
    }
  })

  return {
    assignments,
    stats: {
      total_tasks: T,
      total_workers: W,
      base_per_worker: base,
      remainder,
      distribution,
    },
  }
}

/**
 * Validate tasks array from admin upload.
 * Returns { valid, errors }
 *
 * @param {Array} rawTasks
 * @returns {{ valid: Array, errors: Array<string> }}
 */
export function validateTasks(rawTasks) {
  if (!Array.isArray(rawTasks)) {
    return { valid: [], errors: ['البيانات يجب أن تكون مصفوفة (Array)'] }
  }
  if (rawTasks.length === 0) {
    return { valid: [], errors: ['المصفوفة فارغة'] }
  }
  if (rawTasks.length > 10000) {
    return { valid: [], errors: [`الحد الأقصى 10,000 مهمة في كل رفع. أرسلت ${rawTasks.length}`] }
  }

  const valid = []
  const errors = []

  rawTasks.forEach((task, i) => {
    const row = i + 1

    if (!task || typeof task !== 'object') {
      errors.push(`صف ${row}: يجب أن يكون كائن JSON`)
      return
    }

    const proverb = task.proverb?.toString().trim()
    if (!proverb) {
      errors.push(`صف ${row}: حقل "proverb" مطلوب`)
      return
    }
    if (proverb.length < 3) {
      errors.push(`صف ${row}: المثل قصير جداً (${proverb.length} حروف)`)
      return
    }
    if (proverb.length > 500) {
      errors.push(`صف ${row}: المثل طويل جداً (${proverb.length} حرف، الحد 500)`)
      return
    }

    let sentences = task.context_sentences
    if (!sentences) {
      // Accept flat fields as fallback: sentence_1, sentence_2, sentence_3
      const s1 = task.sentence_1 || task.context_1 || ''
      const s2 = task.sentence_2 || task.context_2 || ''
      const s3 = task.sentence_3 || task.context_3 || ''
      sentences = [s1, s2, s3].map(s => s.toString().trim()).filter(Boolean)
    }

    if (!Array.isArray(sentences) || sentences.length < 3) {
      errors.push(`صف ${row}: يجب توفير 3 جمل سياقية على الأقل في "context_sentences"`)
      return
    }

    const cleanSentences = sentences.slice(0, 3).map(s => s.toString().trim())
    if (cleanSentences.some(s => !s || s.length < 5)) {
      errors.push(`صف ${row}: كل جملة سياقية يجب أن تحتوي على 5 أحرف على الأقل`)
      return
    }

    valid.push({
      proverb,
      context_sentences: cleanSentences,
    })
  })

  return { valid, errors: errors.slice(0, 20) }  // cap errors at 20 to avoid huge payloads
}

/**
 * Chunk array into batches for bulk inserts.
 * Avoids memory spikes with 10k+ rows.
 *
 * @param {Array} arr
 * @param {number} size
 * @returns {Array<Array>}
 */
export function chunkArray(arr, size = 500) {
  const chunks = []
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size))
  }
  return chunks
}

/**
 * Shuffle array using Fisher-Yates.
 * Use when you want random distribution instead of sequential.
 *
 * @param {Array} arr
 * @returns {Array}
 */
export function shuffleArray(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
