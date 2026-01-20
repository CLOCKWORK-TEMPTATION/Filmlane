import { downloadFile } from './exporters';

export interface ScreenplayData {
  content: string;
  metadata: {
    title: string;
    author: string;
    date: string;
    version: string;
  };
}

export const saveScreenplay = (data: ScreenplayData, filename: string = 'screenplay.json') => {
  const jsonContent = JSON.stringify(data, null, 2);
  downloadFile(jsonContent, filename, 'application/json');
};

export const loadScreenplay = (): Promise<ScreenplayData | null> => {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) {
        resolve(null);
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const data = JSON.parse(event.target?.result as string);
          resolve(data);
        } catch (error) {
          console.error('فشل تحميل الملف:', error);
          resolve(null);
        }
      };
      reader.readAsText(file);
    };

    input.click();
  });
};
