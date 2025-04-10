import React, { useState } from "react";
import { Typography, Card, Button, IconButton } from "../components/ui";
import { CogIcon } from "@heroicons/react/24/solid";

const Popup: React.FC = () => {
  return (
    <div className="w-80 p-4">
      <div className="flex items-center justify-between">
        <Typography variant="h1" className="text-primary">
          OopsTab
        </Typography>
        <IconButton size="sm">
          <CogIcon className="h-5 w-5" />
        </IconButton>
      </div>

      <Card className="mt-4">
        <Typography variant="body">Tab snapshot manager</Typography>
        <div className="mt-3 flex space-x-2">
          <Button variant="primary" size="sm">
            Take Snapshot
          </Button>
          <Button variant="passive" size="sm">
            View History
          </Button>
        </div>
      </Card>
    </div>
  );
};

export default Popup;
