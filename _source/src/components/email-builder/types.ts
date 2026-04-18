export type BlockType = 'text' | 'image' | 'button' | 'divider' | 'spacer' | 'columns' | 'heading' | 'social' | 'canvas_settings';

export interface EmailBlock {
  id: string;
  type: BlockType;
  props: Record<string, any>;
}

export const defaultBlockProps: Record<BlockType, Record<string, any>> = {
  text: { content: '<p>Escribe tu texto aquí...</p>', fontSize: '16', color: '#333333', align: 'left', padding: '10' },
  heading: { content: 'Título', level: 'h2', fontSize: '28', color: '#111111', align: 'center', padding: '10' },
  image: { src: '', alt: 'Imagen', width: '100', align: 'center', padding: '10', link: '' },
  button: { text: 'Click aquí', link: '#', bgColor: '#2563EB', textColor: '#FFFFFF', borderRadius: '6', align: 'center', padding: '10', fontSize: '16' },
  divider: { color: '#E5E7EB', thickness: '1', padding: '10' },
  spacer: { height: '30' },
  columns: { columns: 2, gap: '10', padding: '10', children: [[], []] },
  social: { networks: ['facebook', 'twitter', 'instagram', 'linkedin'], align: 'center', iconSize: '32', padding: '10' },
  canvas_settings: { bgColor: '#f4f4f5', contentBgColor: '#ffffff', contentPadding: '16', contentBorderRadius: '8', footerText: '' },
};

export interface CanvasSettings {
  bgColor: string;
  contentBgColor: string;
  contentPadding: string;
  contentBorderRadius: string;
  footerText?: string;
}

export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  blocks: EmailBlock[];
  html_content: string | null;
  campaign_id: string | null;
  user_id: string;
  created_at: string;
  updated_at: string;
}

export const VARIABLE_LIST = [
  { label: 'Nombre', value: '{{nombre}}' },
  { label: 'Apellido', value: '{{apellido}}' },
  { label: 'Email', value: '{{email}}' },
  { label: 'Teléfono', value: '{{telefono}}' },
  { label: 'Empresa', value: '{{empresa}}' },
  { label: 'Cargo', value: '{{cargo}}' },
  { label: 'Puntuación', value: '{{puntuacion}}' },
];
