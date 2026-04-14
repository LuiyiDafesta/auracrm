import { EmailBlock } from './types';

export function blocksToHtml(blocks: EmailBlock[], previewWidth = 600): string {
  const inner = blocks.map(blockToHtml).join('\n');
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>body{margin:0;padding:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif}
.email-wrapper{max-width:${previewWidth}px;margin:0 auto;background:#ffffff}
img{max-width:100%;height:auto}</style></head>
<body><div class="email-wrapper">${inner}</div></body></html>`;
}

function blockToHtml(block: EmailBlock): string {
  const p = block.props;
  switch (block.type) {
    case 'heading':
      return `<div style="text-align:${p.align};padding:${p.padding}px;color:${p.color};font-size:${p.fontSize}px;font-weight:700">${p.content}</div>`;
    case 'text':
      return `<div style="text-align:${p.align};padding:${p.padding}px;color:${p.color};font-size:${p.fontSize}px;line-height:1.6">${p.content}</div>`;
    case 'image': {
      const img = p.src ? `<img src="${p.src}" alt="${p.alt}" style="max-width:${p.width}%;height:auto;display:inline-block">` : '';
      const wrapped = p.link ? `<a href="${p.link}" target="_blank">${img}</a>` : img;
      return `<div style="text-align:${p.align};padding:${p.padding}px">${wrapped}</div>`;
    }
    case 'button':
      return `<div style="text-align:${p.align};padding:${p.padding}px"><a href="${p.link}" target="_blank" style="display:inline-block;background:${p.bgColor};color:${p.textColor};padding:12px 28px;border-radius:${p.borderRadius}px;text-decoration:none;font-weight:600;font-size:${p.fontSize}px">${p.text}</a></div>`;
    case 'divider':
      return `<div style="padding:${p.padding}px"><hr style="border:0;border-top:${p.thickness}px solid ${p.color}"></div>`;
    case 'spacer':
      return `<div style="height:${p.height}px"></div>`;
    case 'columns':
      return `<div style="display:flex;gap:${p.gap}px;padding:${p.padding}px">${Array.from({ length: p.columns }).map(() => '<div style="flex:1"></div>').join('')}</div>`;
    case 'social':
      return `<div style="text-align:${p.align};padding:${p.padding}px">${(p.networks || []).map((n: string) => `<span style="display:inline-block;width:${p.iconSize}px;height:${p.iconSize}px;border-radius:50%;background:#CBD5E1;margin:0 4px;text-align:center;line-height:${p.iconSize}px;font-size:12px;font-weight:bold">${n[0].toUpperCase()}</span>`).join('')}</div>`;
    default:
      return '';
  }
}
