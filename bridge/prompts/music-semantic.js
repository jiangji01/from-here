function compactContext({ anchor, radius, instruction, positiveArtists = [], negativeArtists = [] }) {
  return [
    `Anchor: ${anchor.artist} — ${anchor.title}${anchor.album ? ` · ${anchor.album}` : ''}`,
    `Exploration distance: ${radius}/100`,
    `Session instruction: ${instruction || '无'}`,
    `Positive signals: ${positiveArtists.join('、') || '无'}`,
    `Negative signals: ${negativeArtists.join('、') || '无'}`,
    anchor.lyricContext ? `Lyric semantic context: ${anchor.lyricContext}` : ''
  ].join('\n');
}

const ANALYSIS_SYSTEM = `你是一名具有音乐审美判断力的推荐系统核心。你的任务不是寻找“标签相似的歌曲”，而是理解：用户为什么会在此刻被 Anchor Song 吸引，以及沿着这种体验继续探索时，哪些音乐既有连续性，又能产生合理的惊喜。

相似不是单维度的。Genre、BPM、艺人相似度只能作为弱信号。你必须优先理解真实的听觉体验：人声音色、真假音与演唱方式、咬字、和声、编制、声音质感、节奏运动、动态结构、旋律与和声、意境、叙事感，以及歌曲真正的情感内核。

Preference ≠ Intent ≠ State。你服务的是“用户此刻想待在哪一个音乐世界里”，不是长期猜你喜欢。

如果提供了 Lyric semantic context，它只用于理解歌词语义、意象、叙事与情感，不允许据此臆测音色、编曲、节奏或制作质感。对于中文歌、独立音乐或你不熟悉的作品，优先利用这段语义上下文，而不是因为知识不足退化成“同歌手/同专辑=相似”。

如果不确定某个事实，请标记 unknown 或减少权重，不要编造具体音乐事实。只输出严格 JSON。`;

function buildAnchorAnalysisPrompt({ anchor, radius, instruction = '' }) {
  return `${compactContext({ anchor, radius, instruction })}

请先建立 Anchor 的 Music Fingerprint。不要直接给最终歌曲。

A. Vocal Identity｜人声身份
- 男声 / 女声 / 男女对唱 / 群唱 / 纯器乐
- 主唱音色：清亮、温暖、冷、沙哑、粗粝、空灵、鼻音、少年感、成熟感、中性、脆弱、厚重等
- 声线位置：偏高 / 中频 / 低沉
- 演唱方式：真声、假声、混声、气声、呢喃、爆发、克制、戏剧化
- 真假音转换是否构成关键魅力
- 咬字与表达方式
- 人声距离：贴耳 / 中景 / 空间化
- 是否存在重要和声、男女声互动、群唱

B. Emotional Core｜情感内核
不要只用 happy / sad / energetic。描述更具体的心理状态，例如：克制的悲伤、青春感、疏离、怀旧、孤独但不绝望、野性、自由、童话感、神秘、宗教感、宏大、私密、温柔、压抑、释放、冷静、愤怒、浪漫、废墟感、公路感、夜晚感、冬日感、海洋感、森林感。
回答：这首歌真正让人进入怎样的精神空间？

C. Imagery & Atmosphere｜意境与空间
描述音乐制造的心理空间，不要求歌词真的描写：森林、冬日城市、夜间公路、海边、荒野、小镇、教堂、草地、黄昏、黑夜、梦境等。

D. Rhythm & Motion｜节奏与运动方式
BPM 只作辅助。判断稳定 / 摇摆 / 奔跑 / 行进 / 漂浮 / 下坠；鼓点、groove、强弱变化、build-up、高潮；以及身体感：想走路、奔跑、摇摆、静止、闭眼。

E. Dynamics｜动态结构
平缓到底 / 缓慢堆积 / 突然爆发 / 多次高潮 / 强弱交替 / 前段克制后段释放 / 高潮后回落。

F. Instrumentation & Texture｜编制与声音质感
Acoustic / Electronic；吉他、钢琴、弦乐、Synth、Bass、Percussion、管乐、民族乐器、环境声、Noise；以及稀疏/密集、粗糙/光滑、温暖/冷、Lo-fi/Hi-fi、颗粒感、声场宽窄、干湿、Reverb。
重点不是“用了什么乐器”，而是这些声音形成了什么触感。

G. Melody & Harmony｜旋律与和声
Melody-driven / Rhythm-driven / Atmosphere-driven；旋律记忆度、跨度、明暗感、和声复杂度、重复性、Hook 强度。判断用户可能迷恋的是旋律，还是声音氛围。

H. Narrative Feeling｜叙事感
判断更像：一个故事 / 一段独白 / 一个场景 / 一种氛围 / 一场表演 / 一次情绪爆发。

然后提取：
1. must_preserve：当前探索不能轻易失去的 3-6 个核心体验；
2. can_drift：允许变化的维度；探索距离越大，变化范围越大，但 must_preserve 不应同时全部消失；
3. recall_directions：2-4 条合理的探索方向。每条包括 why / preserve / drift / search_artists / search_keywords。可以非线性联想，但必须解释为什么仍然从 Anchor 出发成立。不要在这里输出具体歌曲名作为最终结果。
4. avoid_transforms：默认要规避的体验突变，例如 tribute / karaoke / instrumental reinterpretation。若 Anchor 人声是核心魅力，纯器乐、karaoke、tribute instrumental 不应成为主要方向，除非用户明确要求。

严格输出 JSON：
{
  "summary":"一句话概括这首歌不可替代的体验",
  "fingerprint":{
    "vocal_identity":[],
    "emotional_core":[],
    "imagery":[],
    "rhythm_motion":[],
    "dynamics":[],
    "instrumentation_texture":[],
    "melody_harmony":[],
    "narrative":[],
    "must_preserve":[],
    "can_drift":[]
  },
  "recall_directions":[
    {
      "name":"",
      "reason":"",
      "preserve":[],
      "drift":[],
      "search_artists":[],
      "search_keywords":[]
    }
  ],
  "avoid_transforms":[]
}`;
}

const RANK_SYSTEM = `你负责一次临时听歌 Session 的“下一步”判断。目标不是找最像的歌，而是找最自然、最有趣、最不破坏用户当下状态的下一步。

只允许从给定的真实候选池中选择，绝对禁止创造不存在于候选池中的歌曲。Genre 相似不等于体验相似。用户可能长期喜欢某首歌，但它仍然可能不属于此刻。

请重点判断：Vocal compatibility、音色和真假音连续性、情感内核、意境、节奏运动、动态结构、编制与 texture、旋律/和声、叙事与精神空间。若 Anchor 的人声是核心魅力，从 vocal song 突然跳到纯器乐翻奏通常是严重体验断裂。

最终问自己：如果用户此刻正沉浸在 Anchor 中，接下来哪一小段音乐最自然？Primary Anchor 始终是原点；用户不需要逐首确认才能继续。只输出严格 JSON。`;

function buildRankingPrompt({ anchor, radius, instruction = '', analysis, candidates, positiveArtists = [], negativeArtists = [] }) {
  const simplified = candidates.map((t, i) => ({
    candidate_id: i,
    artist: t.artist,
    title: t.title,
    album: t.album || '',
    tags: t.tags || [],
    source: t.source,
    semantic_reason: t.semanticReason || '',
    familiarity: t.liked ? 'liked' : (t.recent ? 'recent' : '')
  }));

  return `${compactContext({ anchor, radius, instruction, positiveArtists, negativeArtists })}

Anchor Fingerprint:
${JSON.stringify(analysis?.fingerprint || {}, null, 2)}

Must Preserve:
${JSON.stringify(analysis?.fingerprint?.must_preserve || [])}

Can Drift:
${JSON.stringify(analysis?.fingerprint?.can_drift || [])}

下面是音乐平台返回的真实候选：
${JSON.stringify(simplified)}

Ranking 原则：
1. Continuity：是否延续 Anchor 最重要的听觉体验？
2. Interesting Difference：是否有一点新东西，而不是机械复制？
3. Vocal Compatibility：人声音色、演唱方式、真假音、和声与人声存在感是否自然衔接？
4. Emotional Continuity：情感内核的变化是否像人类自然发生的下一步？
5. Sonic Texture：声音质感是否突然跳出当前世界？
6. Motion：节奏与身体感是否自然？
7. Narrative / Atmosphere：是否仍处在相近的精神空间？
8. Perceptual continuity：召回来源（heartbeat / FM / search）只表示候选来自哪里，绝不等于音乐距离。不要因为 source=heartbeat 就假设它靠近 Anchor。
9. Distance：${radius}/100 是“最大允许漂移边界”，不是越远越好。
10. Familiarity：liked/recent 只是很弱的个人熟悉度信号，只能在两首同样适合当前 Session 时打破平局，绝不能覆盖听感连续性。
11. Same album：同歌手、同专辑只是目录关系，不等于听感相似。除非用户把距离拉到极近，否则不要让同一专辑成为主要结果来源。

强约束：
- 非 Anchor Artist 默认最多 1 首；Anchor Artist 只有在极近距离才允许最多 2 首，普通距离优先只保留 1 首。
- 同一 artist + album 默认最多 1 首，避免用同专辑替代真正的听感判断。
- 不允许 Tribute / Guitar Tribute / Karaoke / Cover Compilation 大量占据结果。
- Anchor 是 vocal song 且人声为关键体验时，instrumental cover 默认强降权，除非用户明确要求纯器乐/翻奏。
- 不要因为标题相同、是 cover 或原作关联，就认定体验相似。
- 结果必须同时满足连续性、多样性、少量惊喜。
- 这是一个连续 Session，不是只挑冠军。如果候选中存在足够多合格歌曲，请按质量排序输出至少 5 首、最多 10 首；只有真正无法守住边界时才少于 5 首。不要因为第一名最强就只返回 1 首。
- “用户可能喜欢”不能作为唯一理由。
- 对每个候选逐项判断连续性，不允许用一个“整体感觉像”覆盖明显的声音断裂。
- world_breaks 是致命断裂，例如 acoustic folk → four-on-the-floor EDM、核心人声 → 纯器乐、私密声场 → festival dance drop。
- 距离 <=45 时，存在明显 world_break 的候选不应该进入推荐。
- 如果你并不了解某首候选的声音特征，把 confidence 标记为 low；不要凭歌名或专辑名想象它很像。

严格输出 JSON：
{
  "ranking":[
    {
      "candidate_id":0,
      "score":0,
      "reason":"不超过24字的中文理由",
      "perceptual_distance":0,
      "distance_from_anchor":"near|medium|far",
      "confidence":"high|medium|low",
      "continuity":{
        "vocal":0.0,
        "timbre":0.0,
        "instrumentation_texture":0.0,
        "rhythm_motion":0.0,
        "dynamics":0.0,
        "emotional_core":0.0,
        "imagery_narrative":0.0
      },
      "world_breaks":[]
    }
  ]
}`;
}

module.exports = {
  ANALYSIS_SYSTEM,
  RANK_SYSTEM,
  buildAnchorAnalysisPrompt,
  buildRankingPrompt
};
