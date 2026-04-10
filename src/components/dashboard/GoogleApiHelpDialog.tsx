import * as React from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button, type ButtonProps } from "@/components/ui/button";
import { ExternalLink, KeyRound } from "lucide-react";

type GoogleApiHelpDialogProps = Omit<ButtonProps, "asChild"> & {
  buttonText?: string;
};

export const GoogleApiHelpDialog = React.forwardRef<HTMLButtonElement, GoogleApiHelpDialogProps>(
  ({ buttonText = "Google API Key kaise banayen?", ...buttonProps }, ref) => {
    return (
      <Dialog>
        <DialogTrigger asChild>
          <Button ref={ref} type="button" variant="outline" size="sm" {...buttonProps}>
            <KeyRound className="mr-2 h-4 w-4" />
            {buttonText}
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Google Drive API Key banane ka tareeqa</DialogTitle>
            <DialogDescription>Public folder listing ke liye API key chahiye hoti hai (AIza…)</DialogDescription>
          </DialogHeader>

          <ol className="list-decimal pl-5 space-y-2 text-sm text-foreground">
            <li>
              Google Cloud Console open karo → <b>APIs &amp; Services</b> → <b>Credentials</b>
            </li>
            <li>
              <b>Create credentials</b> → <b>API key</b>
            </li>
            <li>
              <b>APIs &amp; Services</b> → <b>Library</b> me jaa ke <b>Google Drive API</b> enable karo
            </li>
            <li>Jo key mile (AIza…), usko yahan app me <b>Google API Key</b> field me paste kar do</li>
            <li>Best practice: key ko restrict karo (HTTP referrers me apni domain/preview domain add). (Optional)</li>
          </ol>

          <div className="pt-2">
            <a
              className="inline-flex items-center text-sm text-primary hover:underline"
              href="https://console.cloud.google.com/apis/credentials"
              target="_blank"
              rel="noreferrer"
            >
              Open Google Credentials <ExternalLink className="ml-2 h-4 w-4" />
            </a>
          </div>
        </DialogContent>
      </Dialog>
    );
  },
);
GoogleApiHelpDialog.displayName = "GoogleApiHelpDialog";

export default GoogleApiHelpDialog;

