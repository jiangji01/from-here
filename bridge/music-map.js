const PROFILES = {
  kent: {
    label: '冷 / 克制 / 北欧 / 旋律',
    vibes: ['冷感', '克制', '北欧', '旋律', '夜色', 'alternative rock'],
    closeArtists: ['Mew', 'Kashmir', 'Editors', 'The Radio Dept.', 'The National', 'Interpol', 'Doves'],
    farArtists: ['Sigur Rós', 'Placebo', 'Radiohead', 'The Cure', 'Keane']
  },
  'of monsters and men': {
    label: '自然 / 北欧 / 民谣 / 史诗感',
    vibes: ['自然', '北欧', '民谣', '开阔', 'cinematic'],
    closeArtists: ['First Aid Kit', 'Daughter', 'Bon Iver', 'Ben Howard', 'The Lumineers'],
    farArtists: ['Novo Amor', 'Sigur Rós', 'Florence + The Machine']
  },
  'novo amor': {
    label: '轻盈 / 脆弱 / 空气感',
    vibes: ['轻盈', '脆弱', '空气感', '安静', 'ambient folk'],
    closeArtists: ['Bon Iver', 'Daughter', 'RY X', 'Hollow Coves', 'The Paper Kites'],
    farArtists: ['Sigur Rós', 'Sufjan Stevens', 'José González']
  },
  enya: {
    label: '空灵 / 宁静 / 空间感',
    vibes: ['空灵', '宁静', '空间感', '冥想', 'ethereal'],
    closeArtists: ['Loreena McKennitt', 'Clannad', 'Secret Garden', 'Sarah Brightman'],
    farArtists: ['Cocteau Twins', 'Dead Can Dance']
  },
  '王菲': {
    label: '空灵 / 疏离 / 梦感',
    vibes: ['空灵', '疏离', '梦感', 'art pop', 'intimate'],
    closeArtists: ['窦唯', '陈绮贞', '林忆莲'],
    farArtists: ['Cocteau Twins', 'Massive Attack', 'Björk']
  },
  '周杰伦': {
    label: '旋律 / R&B / 怀旧 / 电影感',
    vibes: ['旋律', 'R&B', '怀旧', '电影感', 'Mandopop'],
    closeArtists: ['方大同', '陶喆', '王力宏'],
    farArtists: ['宇多田ヒカル', 'Nujabes', '椎名林檎']
  }
};

function profileFor(artist = '') {
  const key = String(artist).trim().toLowerCase();
  for (const [name, p] of Object.entries(PROFILES)) {
    if (key.includes(name) || name.includes(key)) return p;
  }
  return null;
}

module.exports = { PROFILES, profileFor };
