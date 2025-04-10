import React, { useState } from "react";
import { Typography, Card, Toggle, Button } from "../components/ui";

const Options: React.FC = () => {
  const [autoSnapshot, setAutoSnapshot] = useState(false);
  const [darkMode, setDarkMode] = useState(false);

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <Typography variant="h1" className="text-primary">
        OopsTab Settings
      </Typography>

      <Card className="mt-6">
        <Typography variant="h2">Preferences</Typography>

        <div className="mt-4 space-y-4">
          <Toggle
            checked={autoSnapshot}
            onChange={setAutoSnapshot}
            label="Enable auto-snapshot"
          />

          <Toggle checked={darkMode} onChange={setDarkMode} label="Dark mode" />
        </div>

        <div className="mt-6 flex space-x-3">
          <Button variant="primary">Save Settings</Button>
          <Button variant="danger">Reset All</Button>
        </div>
      </Card>
    </div>
  );
};

export default Options;
