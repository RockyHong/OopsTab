import React from "react";
import Typography from "./Typography";
import Button from "./Button";
import Card from "./Card";
import { cn } from "../../utils/classnames";

const ThemeExample: React.FC = () => {
  return (
    <div className="p-lg">
      <Typography variant="h1" className="mb-md">
        Theme System Example
      </Typography>

      <section className="mb-xl">
        <Typography variant="h3" className="mb-md">
          Typography
        </Typography>
        <Card className="mb-md">
          <Typography variant="h1">Heading 1</Typography>
          <Typography variant="h2">Heading 2</Typography>
          <Typography variant="h3">Heading 3</Typography>
          <Typography variant="h4">Heading 4</Typography>
          <Typography variant="h5">Heading 5</Typography>
          <Typography variant="h6">Heading 6</Typography>
          <div className="spacer-md" />
          <Typography variant="body-lg">
            Large body text for important paragraphs
          </Typography>
          <Typography variant="body">
            Regular body text for normal content
          </Typography>
          <Typography variant="body-sm">
            Small body text for less important content
          </Typography>
          <Typography variant="caption">
            Caption text for labels and metadata
          </Typography>
        </Card>
      </section>

      <section className="mb-xl">
        <Typography variant="h3" className="mb-md">
          Colors
        </Typography>
        <Card className="mb-md">
          <div className="grid grid-cols-2 gap-md">
            <div>
              <Typography variant="h4" className="mb-sm">
                Text Colors
              </Typography>
              <Typography color="primary">Primary Text</Typography>
              <Typography color="secondary">Secondary Text</Typography>
              <Typography color="disabled">Disabled Text</Typography>
              <Typography color="accent">Accent Text</Typography>
              <Typography color="danger">Danger Text</Typography>
              <div className="bg-gray-800 p-sm rounded">
                <Typography color="inverse">Inverse Text</Typography>
              </div>
            </div>

            <div>
              <Typography variant="h4" className="mb-sm">
                Background Colors
              </Typography>
              <div
                className={cn("p-sm rounded mb-xs", "bg-primary text-white")}
              >
                Primary
              </div>
              <div
                className={cn("p-sm rounded mb-xs", "bg-secondary text-white")}
              >
                Secondary
              </div>
              <div className={cn("p-sm rounded mb-xs", "bg-accent text-white")}>
                Accent
              </div>
              <div
                className={cn(
                  "p-sm rounded mb-xs",
                  "bg-surface text-text-primary"
                )}
              >
                Surface
              </div>
              <div className={cn("p-sm rounded mb-xs", "bg-danger text-white")}>
                Danger
              </div>
              <div
                className={cn(
                  "p-sm rounded",
                  "bg-background-subtle text-text-primary"
                )}
              >
                Background Subtle
              </div>
            </div>
          </div>
        </Card>
      </section>

      <section>
        <Typography variant="h3" className="mb-md">
          Components
        </Typography>
        <Card className="mb-md">
          <div className="flex gap-md flex-wrap">
            <div>
              <Typography variant="h5" className="mb-sm">
                Buttons
              </Typography>
              <div className="flex gap-sm flex-wrap">
                <Button variant="primary">Primary</Button>
                <Button variant="passive">Passive</Button>
                <Button variant="danger">Danger</Button>
              </div>
            </div>

            <div>
              <Typography variant="h5" className="mb-sm">
                Button Sizes
              </Typography>
              <div className="flex gap-sm items-center">
                <Button size="sm">Small</Button>
                <Button size="md">Medium</Button>
                <Button size="lg">Large</Button>
              </div>
            </div>
          </div>

          <div className="spacer-lg" />

          <div>
            <Typography variant="h5" className="mb-sm">
              Cards
            </Typography>
            <div className="grid grid-cols-3 gap-md">
              <Card variant="default" className="h-32">
                <Typography variant="h6">Default Card</Typography>
                <Typography variant="body-sm">With regular styling</Typography>
              </Card>

              <Card variant="highlighted" className="h-32">
                <Typography variant="h6">Highlighted Card</Typography>
                <Typography variant="body-sm">With accent border</Typography>
              </Card>

              <Card variant="inactive" className="h-32">
                <Typography variant="h6">Inactive Card</Typography>
                <Typography variant="body-sm">With reduced opacity</Typography>
              </Card>
            </div>
          </div>
        </Card>
      </section>
    </div>
  );
};

export default ThemeExample;
