
export interface Madde {
  madde_no: string;
  başlık: string;
  içerik: string;
  alt_paragraflar?: {
    paragraf: string;
    metin: string;
  }[];
}

export interface Tanimlar {
  [key: string]: string;
}

export interface Ek {
  id: string; // ek_1, ek_2
  baslik: string;
  icerik: any; // Liste, Dict veya Tablo (Array of objects)
}

export interface BelgeYapisal {
  belge_bilgisi: {
    ad: string;
    tarih?: string;
    yururluk_tarihi?: string;
  };
  maddeler: Madde[];
  tanimlar: Tanimlar;
  ekler: { [key: string]: any };
}

export interface ChunkMetadata {
  doc_id: string;
  doc_type: "madde" | "ek" | "tanim";
  source: string;
  konu?: string;
  madde_no?: string;
  sayfa_no?: number;
  baglantili_maddeler?: string[];
}

export interface DocumentChunk {
  id: string;
  text: string;
  metadata: ChunkMetadata;
}
