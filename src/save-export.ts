import { App, Modal, Platform, Setting, TFolder } from 'obsidian';
import { t } from './lang/helpers';

type ExportFormat = 'png' | 'jpeg' | 'html';

export async function saveExport(app: App, filename: string, format: ExportFormat, data: Blob): Promise<string | null> {
  const extensions = format === 'jpeg' ? ['jpeg', 'jpg'] : format === 'html' ? ['html', 'htm'] : ['png'];
  if (Platform.isDesktopApp) {
    const remote = require('electron').remote ?? require('@electron/remote');
    const { canceled, filePath } = await remote.dialog.showSaveDialog(remote.getCurrentWindow(), {
      title: t('Save export'),
      defaultPath: filename,
      filters: [{ name: format.toUpperCase(), extensions }],
      properties: ['createDirectory', 'showOverwriteConfirmation']
    });
    if (canceled || !filePath) return null;
    await require('fs').promises.writeFile(filePath, new Uint8Array(await data.arrayBuffer()));
    return filePath;
  }

  const path = await new Promise<string | null>(resolve => {
    const modal = new Modal(app);
    let folder = '', name = filename;
    modal.titleEl.setText(t('Save export'));
    new Setting(modal.contentEl).setName(t('Export folder')).addText(input => input
      .setPlaceholder(t('Vault root')).onChange(value => { folder = value.trim(); }));
    new Setting(modal.contentEl).setName(t('Export filename')).addText(input => input
      .setValue(name).onChange(value => { name = value.trim(); }));
    const error = modal.contentEl.createDiv({ attr: { role: 'alert' } });
    new Setting(modal.contentEl)
      .addButton(button => button.setButtonText(t('Cancel')).onClick(() => modal.close()))
      .addButton(button => button.setButtonText(t('Save export')).setCta().onClick(() => {
        if (folder && !(app.vault.getAbstractFileByPath(folder) instanceof TFolder)) {
          error.setText(t('Choose an existing vault folder'));
          return;
        }
        if (!name || /[\\/:*?"<>|\x00-\x1f]|[. ]$/.test(name)) {
          error.setText(t('Enter a valid filename'));
          return;
        }
        const file = extensions.some(ext => name.toLowerCase().endsWith('.' + ext)) ? name : name + '.' + extensions[0];
        const target = folder ? folder + '/' + file : file;
        if (app.vault.getAbstractFileByPath(target)) {
          error.setText(t('Choose a filename that does not already exist'));
          return;
        }
        resolve(target);
        modal.close();
      }));
    modal.onClose = () => resolve(null);
    modal.open();
  });
  if (!path) return null;
  await app.vault.createBinary(path, await data.arrayBuffer());
  return path;
}
