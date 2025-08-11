
'use client';

import { useState, useTransition } from 'react';
import { Upload, X, Image as ImageIcon, FileText, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { uploadFile } from '@/ai/flows/upload-file-flow';
import Image from 'next/image';

interface FileUploadProps {
  value?: string | string[];
  onChange: (url?: string) => void;
  onRemove?: (url: string) => void;
  endpoint: "companyLogo" | "aircraftImage" | "maintenanceCost";
}

export const FileUpload = ({ value, onChange, onRemove, endpoint }: FileUploadProps) => {
  const { toast } = useToast();
  const [isUploading, startUploading] = useTransition();

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
            path: `${endpoint}/${Date.now()}-${file.name}`,
            file: base64String,
            contentType: file.type,
          });
          onChange(result.downloadUrl);
          toast({ title: 'Upload Successful', description: 'Your file has been uploaded.' });
        } catch (error) {
          toast({ title: 'Upload Failed', description: (error as Error).message, variant: 'destructive' });
        }
      });
    };
  };

  const handleRemoveClick = (urlToRemove: string) => {
    if (onRemove) {
        onRemove(urlToRemove);
    } else {
        onChange(undefined);
    }
  };

  const urls = Array.isArray(value) ? value : (value ? [value] : []);

  return (
    <div className="flex flex-col items-center justify-center w-full gap-4">
      <div className="flex items-center justify-center w-full">
        <label
          htmlFor={`file-upload-${endpoint}`}
          className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted"
        >
          <div className="flex flex-col items-center justify-center pt-5 pb-6">
            {isUploading ? (
              <>
                <Loader2 className="w-8 h-8 mb-2 text-muted-foreground animate-spin" />
                <p className="mb-1 text-sm text-muted-foreground">Uploading...</p>
              </>
            ) : (
              <>
                <Upload className="w-8 h-8 mb-2 text-muted-foreground" />
                <p className="mb-1 text-sm text-muted-foreground">
                  <span className="font-semibold">Click to upload</span> or drag and drop
                </p>
                <p className="text-xs text-muted-foreground">PDF, PNG, JPG (MAX. 10MB)</p>
              </>
            )}
          </div>
          <input id={`file-upload-${endpoint}`} type="file" className="hidden" onChange={handleFileChange} disabled={isUploading} />
        </label>
      </div>
      {urls.length > 0 && (
        <div className="w-full space-y-2">
            <p className="text-sm font-medium">Uploaded Files:</p>
            {urls.map((url, index) => {
                const isImage = /\.(jpg|jpeg|png|gif)$/i.test(url);
                const fileName = url.split('/').pop()?.split('?')[0] || 'file';
                const decodedFileName = decodeURIComponent(fileName).substring(fileName.indexOf('-') + 1);

                return (
                    <div key={index} className="relative flex items-center p-2 border rounded-md bg-muted/50">
                        {isImage ? (
                            <Image src={url} alt="Upload preview" width={40} height={40} className="h-10 w-10 object-cover rounded-md" />
                        ) : (
                            <FileText className="h-10 w-10 text-muted-foreground" />
                        )}
                        <a href={url} target="_blank" rel="noopener noreferrer" className="ml-3 text-sm font-medium truncate hover:underline" title={decodedFileName}>
                            {decodedFileName}
                        </a>
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRemoveClick(url)}
                            className="ml-auto h-7 w-7 text-destructive"
                            aria-label="Remove file"
                        >
                            <X className="h-4 w-4" />
                        </Button>
                    </div>
                );
            })}
        </div>
      )}
    </div>
  );
};
