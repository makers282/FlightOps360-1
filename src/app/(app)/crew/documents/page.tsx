
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FolderArchive, UploadCloud, Search, FileText as FileTextIcon } from 'lucide-react'; // Renamed to avoid conflict
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Image from 'next/image';

const crewDocuments = [
  { id: 'DOC001', name: 'Capt. Williams - License.pdf', type: 'License', crewMember: 'Capt. Ava Williams', expiryDate: '2025-12-31', dataAiHint: 'certificate pilot' },
  { id: 'DOC002', name: 'FO Carter - Medical Cert.pdf', type: 'Medical', crewMember: 'FO Ben Carter', expiryDate: '2024-11-15', dataAiHint: 'document medical' },
  { id: 'DOC003', name: 'FA Davis - Passport.pdf', type: 'Passport', crewMember: 'FA Chloe Davis', expiryDate: '2027-06-01', dataAiHint: 'passport official' },
  { id: 'DOC004', name: 'Capt. Smith - Type Rating B737.pdf', type: 'Type Rating', crewMember: 'Capt. John Smith', expiryDate: 'N/A', dataAiHint: 'pilot training' },
];

export default function CrewDocumentsPage() {
  return (
    <>
      <PageHeader 
        title="Crew Documents" 
        description="Manage and track all crew-specific documents, licenses, and certifications."
        icon={FolderArchive}
        actions={
          <Button>
            <UploadCloud className="mr-2 h-4 w-4" /> Upload Crew Document
          </Button>
        }
      />
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>All Crew Documents</CardTitle>
           <CardDescription>Ensure all crew documentation is up-to-date and accessible.</CardDescription>
          <div className="mt-2 relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search crew documents..." className="pl-8 w-full sm:w-1/3" />
          </div>
        </CardHeader>
        <CardContent>
          {crewDocuments.length === 0 ? (
             <div className="text-center py-10">
              <FolderArchive className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-2 text-sm font-medium text-foreground">No Crew Documents</h3>
              <p className="mt-1 text-sm text-muted-foreground">Get started by uploading crew documents.</p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {crewDocuments.map((doc) => (
                <Card key={doc.id} className="flex flex-col hover:shadow-md transition-shadow">
                  <CardHeader className="p-4">
                     <div className="flex items-center gap-3">
                        <FileTextIcon className="h-8 w-8 text-primary flex-shrink-0" />
                        <CardTitle className="text-base font-medium leading-tight">{doc.name}</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="p-4 pt-0 flex-grow">
                     <Image 
                        src={`https://placehold.co/300x200.png?text=${doc.type.replace(/\s/g, '+')}`} 
                        alt={doc.name} 
                        width={300} 
                        height={200} 
                        className="w-full h-32 object-cover rounded-md mb-3"
                        data-ai-hint={doc.dataAiHint}
                      />
                    <p className="text-xs text-muted-foreground">Crew: {doc.crewMember}</p>
                    <p className="text-xs text-muted-foreground">Type: {doc.type}</p>
                    <p className="text-xs text-muted-foreground">Expires: {doc.expiryDate}</p>
                  </CardContent>
                  <div className="p-4 border-t">
                    <Button variant="outline" size="sm" className="w-full">View Document</Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
