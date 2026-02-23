"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { logAudit } from "@/lib/audit";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import type { Document, DocumentStatus, DocumentType } from "@/types/database";

interface DocWithProfile extends Document {
  profiles?: { full_name: string };
}

const statusVariant: Record<DocumentStatus, "default" | "secondary" | "destructive"> = {
  uploaded: "secondary",
  verified: "default",
  rejected: "destructive",
};

export default function DocumentsPage() {
  const supabase = createClient();
  const [docs, setDocs] = useState<DocWithProfile[]>([]);
  const [filterType, setFilterType] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [loading, setLoading] = useState(true);

  const fetchDocs = useCallback(async () => {
    let query = supabase
      .from("documents")
      .select("*, profiles(full_name)")
      .order("created_at", { ascending: false });

    if (filterType !== "all") query = query.eq("type", filterType);
    if (filterStatus !== "all") query = query.eq("status", filterStatus);

    const { data } = await query;
    if (data) setDocs(data as DocWithProfile[]);
    setLoading(false);
  }, [supabase, filterType, filterStatus]);

  useEffect(() => {
    fetchDocs();
  }, [fetchDocs]);

  async function updateDocStatus(docId: string, status: DocumentStatus) {
    const { error } = await supabase
      .from("documents")
      .update({ status })
      .eq("id", docId);

    if (error) {
      toast.error("Failed: " + error.message);
      return;
    }

    await logAudit(supabase, {
      action: `DOCUMENT_${status.toUpperCase()}`,
      entityType: "document",
      entityId: docId,
    });

    setDocs(docs.map((d) => (d.id === docId ? { ...d, status } : d)));
    toast.success(`Document ${status}`);
  }

  const docTypes: DocumentType[] = ["id_doc", "payslip", "bank_statement", "contract", "other"];
  const statuses: DocumentStatus[] = ["uploaded", "verified", "rejected"];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Documents</h1>
        <p className="text-muted-foreground">Review and verify user documents</p>
      </div>

      <div className="flex gap-4 flex-wrap">
        <div className="flex gap-2 items-center">
          <span className="text-sm text-muted-foreground">Type:</span>
          <Badge
            variant={filterType === "all" ? "default" : "outline"}
            className="cursor-pointer"
            onClick={() => setFilterType("all")}
          >
            All
          </Badge>
          {docTypes.map((t) => (
            <Badge
              key={t}
              variant={filterType === t ? "default" : "outline"}
              className="cursor-pointer"
              onClick={() => setFilterType(t)}
            >
              {t.replace("_", " ")}
            </Badge>
          ))}
        </div>
        <div className="flex gap-2 items-center">
          <span className="text-sm text-muted-foreground">Status:</span>
          <Badge
            variant={filterStatus === "all" ? "default" : "outline"}
            className="cursor-pointer"
            onClick={() => setFilterStatus("all")}
          >
            All
          </Badge>
          {statuses.map((s) => (
            <Badge
              key={s}
              variant={filterStatus === s ? "default" : "outline"}
              className="cursor-pointer"
              onClick={() => setFilterStatus(s)}
            >
              {s}
            </Badge>
          ))}
        </div>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>File</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Uploaded</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {!loading && docs.length > 0 ? (
              docs.map((doc) => (
                <TableRow key={doc.id}>
                  <TableCell className="font-medium">
                    {doc.profiles?.full_name || "Unknown"}
                  </TableCell>
                  <TableCell>{doc.type.replace("_", " ").toUpperCase()}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {doc.file_name}
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusVariant[doc.status]}>
                      {doc.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {new Date(doc.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {doc.status !== "verified" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => updateDocStatus(doc.id, "verified")}
                        >
                          Verify
                        </Button>
                      )}
                      {doc.status !== "rejected" && (
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => updateDocStatus(doc.id, "rejected")}
                        >
                          Reject
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  {loading ? "Loading..." : "No documents found"}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
