import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ShieldAlert, TrendingUp, TrendingDown, Activity, ListChecks } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import Image from 'next/image';

export default function FratPage() {
  const fratAssessments = [
    { id: "FRAT-001", flight: "FL123 (JFK-LAX)", riskScore: 35, status: "Low Risk", date: "2024-08-15", assessedBy: "John Doe", dataAiHint: "aviation risk" },
    { id: "FRAT-002", flight: "FL456 (MIA-ORD)", riskScore: 68, status: "Medium Risk", date: "2024-08-14", assessedBy: "Jane Smith", dataAiHint: "flight safety" },
    { id: "FRAT-003", flight: "FL789 (DAL-ATL)", riskScore: 85, status: "High Risk", date: "2024-08-13", assessedBy: "Robert Brown", dataAiHint: "cockpit control" },
  ];

  const getRiskColor = (score: number) => {
    if (score < 50) return "text-green-500";
    if (score < 75) return "text-yellow-500";
    return "text-red-500";
  };
  
  const getProgressColor = (score: number) => {
    if (score < 50) return "bg-green-500";
    if (score < 75) return "bg-yellow-500";
    return "bg-red-500";
  }


  return (
    <>
      <PageHeader 
        title="FRAT Integration" 
        description="Manage and review Flight Risk Assessments to ensure operational safety."
        icon={ShieldAlert}
        actions={<Button><ListChecks className="mr-2 h-4 w-4" /> New Assessment</Button>}
      />
      
      <div className="grid gap-6 mb-6 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overall Risk Level</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-500">Medium</div>
            <p className="text-xs text-muted-foreground">Based on active assessments</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Assessments Today</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">5</div>
            <p className="text-xs text-muted-foreground">+2 from yesterday</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">High Risk Flights</CardTitle>
            <TrendingDown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">1</div>
            <p className="text-xs text-muted-foreground">Requires immediate attention</p>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Recent Flight Risk Assessments</CardTitle>
          <CardDescription>Review details of recent FRAT submissions.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {fratAssessments.map((assessment) => (
              <Card key={assessment.id} className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-lg">{assessment.flight}</CardTitle>
                      <CardDescription>ID: {assessment.id} | Assessed by: {assessment.assessedBy} on {assessment.date}</CardDescription>
                    </div>
                    <Image src={`https://placehold.co/120x80.png`} alt="Flight map" width={120} height={80} className="rounded-md object-cover" data-ai-hint={assessment.dataAiHint} />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-medium">Risk Score: <span className={`font-bold ${getRiskColor(assessment.riskScore)}`}>{assessment.riskScore} / 100</span></p>
                    <p className={`text-sm font-semibold ${getRiskColor(assessment.riskScore)}`}>{assessment.status}</p>
                  </div>
                  <Progress value={assessment.riskScore} aria-label={`${assessment.riskScore}% risk`} indicatorClassName={getProgressColor(assessment.riskScore)} />
                  {/* indicatorClassName needs to be implemented in Progress component or use style prop */}
                  {/* For now, let's use a simpler Progress or style it directly if possible */}
                  {/* <Progress value={assessment.riskScore} className={`[&>div]:${getProgressColor(assessment.riskScore)}`} /> */}
                </CardContent>
                <div className="border-t p-4 flex justify-end">
                  <Button variant="outline" size="sm">View Full Report</Button>
                </div>
              </Card>
            ))}
          </div>
           {fratAssessments.length === 0 && (
            <div className="text-center py-10">
              <ShieldAlert className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-2 text-sm font-medium text-foreground">No FRAT assessments found</h3>
              <p className="mt-1 text-sm text-muted-foreground">Start by creating a new assessment.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
