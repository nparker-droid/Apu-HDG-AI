export const saveBlobWithPicker = async (
  blob: Blob,
  suggestedName: string,
  description: string,
  accept: Record<string, string[]>
) => {
  const win = window as any;

  if (win.showSaveFilePicker) {
    const handle = await win.showSaveFilePicker({
      suggestedName,
      types: [{ description, accept }]
    });
    const writable = await handle.createWritable();
    await writable.write(blob);
    await writable.close();
    return;
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = suggestedName;
  a.click();
  URL.revokeObjectURL(url);
};