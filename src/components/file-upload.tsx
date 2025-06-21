
'use client';

import { useState, useTransition } from 'react';
import { Upload, X, Image as ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { uploadFile } from '@/ai/flows/upload-file-flow';

interface FileUploadProps {
  value?: string;
  onChange: (url?: string) => void;
  endpoint: "companyLogo" | "aircraftImage";
}

export const FileUpload = ({ value, onChange, endpoint }: FileUploadProps) => {
  const { toast } = useToast();
  const [isUploading, startUploading] = useTransition();
  const [preview, setPreview] = useState<string | null>(value || null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onloadend = () => {
      const base64String = reader.result?.toString().split(',')[1];
      if (!base64String) return;

      startUploading(async () => {
        try {
          const result = await uploadFile({
            path: `${endpoint}/${file.name}`,
            file: base64String,
            contentType: file.type,
          });
          onChange(result.downloadUrl);
          setPreview(result.downloadUrl);
          toast({ title: 'Upload Successful', description: 'Your file has been uploaded.' });
        } catch (error) {
          toast({ title: 'Upload Failed', description: (error as Error).message, variant: 'destructive' });
        }
      });
    };
  };

  const handleRemove = () => {
    setPreview(null);
    onChange(undefined);
  };

  return (
    <div className="flex flex-col items-center justify-center w-full">
      {preview ? (
        <div className="relative h-48 w-full">
          <img src={preview} alt="Upload preview" className="h-full w-full object-contain rounded-md" />
          <Button
            type="button"
            variant="destructive"
            size="icon"
            onClick={handleRemove}
            className="absolute top-2 right-2 h-7 w-7"
            aria-label="Remove image"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <div className="flex items-center justify-center w-full">
          <label
            htmlFor="file-upload"
            className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted"
          >
            <div className="flex flex-col items-center justify-center pt-5 pb-6">
              {isUploading ? (
                <>
                  <div className="loader ease-linear rounded-full border-4 border-t-4 border-gray-200 h-12 w-12 mb-4"></div>
                  <p className="mb-2 text-sm text-muted-foreground">Uploading...</p>
                </>
              ) : (
                <>
                  <Upload className="w-10 h-10 mb-3 text-muted-foreground" />
                  <p className="mb-2 text-sm text-muted-foreground">
                    <span className="font-semibold">Click to upload</span> or drag and drop
                  </p>
                  <p className="text-xs text-muted-foreground">PNG, JPG, GIF up to 10MB</p>
                </>
              )}
            </div>
            <input id="file-upload" type="file" className="hidden" onChange={handleFileChange} disabled={isUploading} />
          </label>
        </div>
      )}
    </div>
  );
};
