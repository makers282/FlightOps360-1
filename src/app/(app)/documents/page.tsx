import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FileText, UploadCloud, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Image from 'next/image';

export default function DocumentsPage() {
  const documents = [
    { name: "Flight Manual A320 Rev 12.pdf", type: "Manual", size: "15.2 MB", lastModified: "2024-07-15", dataAiHint: "document manual" },
    { name: "Compliance Checklist Q3-2024.docx", type: "Checklist", size: "1.5 MB", lastModified: "2024-07-01", dataAiHint: "checklist form" },
    { name: "Aircraft N123AB Registration.pdf", type: "Legal", size: "850 KB", lastModified: "2024-06-20", dataAiHint: "certificate legal" },
    { name: "FRAT Form Template.pdf", type: "Template", size: "300 KB", lastModified: "2024-05-10", dataAiHint: "form template" },
  ];

  return (
    <>
      <PageHeader 
        title="Document Hub" 
        description="Manage and access all relevant flight operations and compliance documents."
        icon={FileText}
        actions={
          <Button>
            <UploadCloud className="mr-2 h-4 w-4" /> Upload Document
          </Button>
        }
      />
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>All Documents</CardTitle>
          <div className="mt-2 relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search documents..." className="pl-8 w-full sm:w-1/3" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {documents.map((doc, index) => (
              <Card key={index} className="flex flex-col">
                <CardHeader className="p-4">
                  <div className="flex items-center gap-3">
                     <FileText className="h-8 w-8 text-primary flex-shrink-0" />
                    <CardTitle className="text-base font-medium leading-tight">{doc.name}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="p-4 pt-0 flex-grow">
                  <Image 
                    src={`https://placehold.co/300x200.png?text=${doc.type}`} 
                    alt={doc.name} 
                    width={300} 
                    height={200} 
                    className="w-full h-32 object-cover rounded-md mb-3"
                    data-ai-hint={doc.dataAiHint}
                  />
                  <p className="text-xs text-muted-foreground">Type: {doc.type}</p>
                  <p className="text-xs text-muted-foreground">Size: {doc.size}</p>
                  <p className="text-xs text-muted-foreground">Modified: {doc.lastModified}</p>
                </CardContent>
                <div className="p-4 border-t">
                   <Button variant="outline" size="sm" className="w-full">View Details</Button>
                </div>
              </Card>
            ))}
          </div>
          {documents.length === 0 && (
            <div className="text-center py-10">
              <FileText className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-2 text-sm font-medium text-foreground">No documents found</h3>
              <p className="mt-1 text-sm text-muted-foreground">Get started by uploading a document.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
