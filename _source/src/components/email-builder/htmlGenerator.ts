import { EmailBlock } from './types';

export function blocksToHtml(blocks: EmailBlock[], previewWidth = 600, canvasSettings?: any): string {
  const inner = blocks.map(blockToHtml).join('\n');
  const bg = canvasSettings?.bgColor || '#f4f4f5';
  const contentBg = canvasSettings?.contentBgColor || '#ffffff';
  const padding = canvasSettings?.contentPadding || '16';
  const radius = canvasSettings?.contentBorderRadius || '0';
  const footerText = canvasSettings?.footerText ? `<div style="text-align:center;font-size:12px;color:#888;margin-top:24px;white-space:pre-wrap;">${canvasSettings.footerText}</div>` : '';

  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<style type="text/css">
  body{margin:0;padding:0;background:${bg};font-family:Arial,Helvetica,sans-serif;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;}
  table{border-spacing:0;}
  img{max-width:100%;height:auto;display:block;border:0;}
  .email-wrapper{width:100%;max-width:${previewWidth}px;margin:0 auto;background:${contentBg};border-radius:${radius}px;overflow:hidden;}
</style>
</head>
<body style="margin:0;padding:0;background:${bg};">
  <center style="width:100%;background:${bg};padding:24px 0;">
    <!--[if mso | IE]>
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="${previewWidth}" style="background-color:${contentBg};margin:0 auto;border-radius:${radius}px;">
    <tr>
    <td style="padding:${padding}px;">
    <![endif]-->
    <div style="max-width:${previewWidth}px;margin:0 auto;background:${contentBg};border-radius:${radius}px;padding:${padding}px;" class="email-wrapper">
      <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0">
        <tr>
          <td>
            ${inner}
          </td>
        </tr>
      </table>
    </div>
    <!--[if mso | IE]>
    </td>
    </tr>
    </table>
    <![endif]-->
    ${footerText}
  </center>
</body>
</html>`;
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
    case 'columns': {
      const children: EmailBlock[][] = p.children || [];
      const colWidth = Math.floor(100 / p.columns);
      return `<div style="padding:${p.padding}px"><table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0"><tr>${Array.from({ length: p.columns }).map((_, i) => `<td width="${colWidth}%" valign="top" style="padding:0 ${p.gap/2}px">${(children[i] || []).map(blockToHtml).join('')}</td>`).join('')}</tr></table></div>`;
    }
    case 'social':
      return `<div style="text-align:${p.align};padding:${p.padding}px">${(p.networks || []).map((n: string) => `<span style="display:inline-block;width:${p.iconSize}px;height:${p.iconSize}px;border-radius:50%;background:#CBD5E1;margin:0 4px;text-align:center;line-height:${p.iconSize}px;font-size:12px;font-weight:bold">${n[0].toUpperCase()}</span>`).join('')}</div>`;
    default:
      return '';
  }
}
