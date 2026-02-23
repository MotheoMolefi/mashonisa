"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import type { Document, DocumentType, DocumentStatus } from "@/types/database";

const DOC_TYPES: { value: DocumentType; label: string }[] = [
  { value: "id_doc", label: "ID Document" },
  { value: "payslip", label: "Latest Payslip" },
  { value: "bank_statement", label: "Bank Statement" },
  { value: "other", label: "Other" },
];

function statusBadge(status: DocumentStatus) {
  switch (status) {
    case "verified":
      return <Badge className="bg-green-600">Verified</Badge>;
    case "rejected":
      return <Badge variant="destructive">Rejected</Badge>;
    default:
      return <Badge variant="secondary">Uploaded</Badge>;
  }
}

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [uploading, setUploading] = useState(false);
  const [docType, setDocType] = useState<DocumentType>("id_doc");
  const supabase = createClient();

  const fetchDocuments = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from("documents")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (data) setDocuments(data as Document[]);
  }, [supabase]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      toast.error("File too large. Maximum size is 10MB.");
      return;
    }

    const allowedTypes = [
      "application/pdf",
      "image/jpeg",
      "image/png",
      "image/webp",
    ];
    if (!allowedTypes.includes(file.type)) {
      toast.error("Invalid file type. Upload PDF, JPG, PNG, or WebP.");
      return;
    }

    setUploading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Not authenticated");
      setUploading(false);
      return;
    }

    const fileExt = file.name.split(".").pop();
    const filePath = `${user.id}/${crypto.randomUUID()}.${fileExt}`;

    // Upload to storage
    const { error: uploadError } = await supabase.storage
      .from("documents")
      .upload(filePath, file);

    if (uploadError) {
      toast.error("Upload failed: " + uploadError.message);
      setUploading(false);
      return;
    }

    // Create document record
    const { error: dbError } = await supabase.from("documents").insert({
      user_id: user.id,
      type: docType,
      storage_path: filePath,
      file_name: file.name,
      status: "uploaded",
    });

    if (dbError) {
      toast.error("Failed to save document: " + dbError.message);
      setUploading(false);
      return;
    }

    toast.success("Document uploaded successfully");
    setUploading(false);
    fetchDocuments();

    // Reset file input
    e.target.value = "";
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Documents</h1>
        <p className="text-muted-foreground">
          Upload your required documents for verification
        </p>
      </div>

      {/* Upload Section */}
      <Card>
        <CardHeader>
          <CardTitle>Upload a Document</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Document Type</Label>
              <Select
                value={docType}
                onValueChange={(v) => setDocType(v as DocumentType)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DOC_TYPES.map((dt) => (
                    <SelectItem key={dt.value} value={dt.value}>
                      {dt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>File (PDF, JPG, PNG — max 10MB)</Label>
              <Input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.webp"
                onChange={handleUpload}
                disabled={uploading}
              />
            </div>
          </div>
          {uploading && (
            <p className="text-sm text-muted-foreground">Uploading...</p>
          )}
        </CardContent>
      </Card>

      {/* Required Documents Checklist */}
      <Card>
        <CardHeader>
          <CardTitle>Required Documents</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[
              { type: "id_doc" as DocumentType, label: "ID Document" },
              { type: "payslip" as DocumentType, label: "Latest Payslip" },
            ].map((req) => {
              const doc = documents.find((d) => d.type === req.type);
              return (
                <div
                  key={req.type}
                  className="flex items-center justify-between rounded-md border p-3"
                >
                  <span className="font-medium">{req.label}</span>
                  {doc ? (
                    statusBadge(doc.status as DocumentStatus)
                  ) : (
                    <Badge variant="outline">Not uploaded</Badge>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* All Documents */}
      <Card>
        <CardHeader>
          <CardTitle>All Documents</CardTitle>
        </CardHeader>
        <CardContent>
          {documents.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No documents uploaded yet.
            </p>
          ) : (
            <div className="space-y-2">
              {documents.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center justify-between rounded-md border p-3"
                >
                  <div>
                    <p className="font-medium">{doc.file_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {DOC_TYPES.find((dt) => dt.value === doc.type)?.label} •{" "}
                      {new Date(doc.created_at).toLocaleDateString()}
                    </p>
                    {doc.notes && (
                      <p className="text-xs text-destructive mt-1">
                        {doc.notes}
                      </p>
                    )}
                  </div>
                  {statusBadge(doc.status as DocumentStatus)}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
