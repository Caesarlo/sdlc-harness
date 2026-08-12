import fs from 'node:fs';

export function renderString(content, data) {
  return content.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    if (!(key in data)) throw new Error(`Missing template variable: ${key}`);
    return String(data[key]);
  });
}

export function renderFile(templatePath, data) {
  return renderString(fs.readFileSync(templatePath, 'utf8'), data);
}
