'use client';

import { Config } from '@/app/api/types.gen';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Label } from '@/app/components/ui/label';
import { Switch } from '@/app/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/app/components/ui/select';
import { Badge } from '@/app/components/ui/badge';
import { Settings2, Server, FileText } from 'lucide-react';
import { Input } from '@/app/components/ui/input';

interface ConfigFormProps {
  config: Config;
  onChange: (config: Config) => void;
}

export function ConfigForm({ config, onChange }: ConfigFormProps) {
  return (
    <Card className="border-border bg-card flex h-full flex-col overflow-hidden shadow-sm">
      <CardHeader className="border-border flex flex-row items-center gap-3 space-y-0 border-b pb-3">
        <div className="rounded-lg bg-violet-100 p-2">
          <Settings2 className="h-5 w-5 text-violet-600" />
        </div>
        <div>
          <CardTitle className="text-base">Configuration Form</CardTitle>
          <p className="text-muted-foreground mt-0.5 text-xs">Edit values directly</p>
        </div>
      </CardHeader>

      <CardContent className="flex-1 space-y-8 overflow-y-auto p-6">
        {/* Server Section */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="bg-primary/10 rounded-md p-1.5">
              <Server className="text-primary h-4 w-4" />
            </div>
            <h3 className="text-sm font-semibold">Server Configuration</h3>
          </div>

          <div className="space-y-4 pl-7">
            <div className="space-y-2">
              <Label htmlFor="host" className="text-foreground">
                Host
                <span className="text-muted-foreground ml-2 text-xs">Hostname or IP address</span>
              </Label>
              <Input
                id="host"
                type="text"
                value={config.server.host}
                onChange={(e) => {
                  onChange({
                    ...config,
                    server: { ...config.server, host: e.target.value },
                  });
                }}
                placeholder="127.0.0.1"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="port" className="text-foreground">
                Port
                <span className="text-muted-foreground ml-2 text-xs">1-65535</span>
              </Label>
              <Input
                id="port"
                type="number"
                min={1}
                max={65535}
                value={config.server.port}
                onChange={(e) => {
                  const port = parseInt(e.target.value, 10);
                  if (!isNaN(port)) {
                    onChange({
                      ...config,
                      server: { ...config.server, port },
                    });
                  }
                }}
              />
            </div>

            <div className="flex items-center justify-between py-2">
              <div className="space-y-0.5">
                <Label htmlFor="use_ssl" className="text-foreground cursor-pointer">
                  Enable SSL
                </Label>
                <p className="text-muted-foreground text-xs">Use HTTPS instead of HTTP</p>
              </div>
              <Switch
                id="use_ssl"
                checked={config.server.use_ssl}
                onCheckedChange={(checked) => {
                  onChange({
                    ...config,
                    server: { ...config.server, use_ssl: checked },
                  });
                }}
              />
            </div>
          </div>
        </div>

        {/* Logging Section */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="rounded-md bg-violet-100 p-1.5">
              <FileText className="h-4 w-4 text-violet-600" />
            </div>
            <h3 className="text-sm font-semibold">Logging Configuration</h3>
          </div>

          <div className="space-y-4 pl-7">
            <div className="space-y-2">
              <Label htmlFor="level" className="text-foreground">
                Log Level
                <span className="text-muted-foreground ml-2 text-xs">Verbosity of logs</span>
              </Label>
              <Select
                value={config.logging.level}
                onValueChange={(value) => {
                  onChange({
                    ...config,
                    logging: {
                      ...config.logging,
                      level: value as 'debug' | 'info' | 'warn' | 'error',
                    },
                  });
                }}
              >
                <SelectTrigger className="font-mono">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="debug" className="font-mono">
                    <div className="flex items-center gap-2">
                      <Badge variant="default" className="text-xs">
                        debug
                      </Badge>
                      <span className="text-muted-foreground text-xs">Most verbose</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="info" className="font-mono">
                    <div className="flex items-center gap-2">
                      <Badge variant="success" className="text-xs">
                        info
                      </Badge>
                      <span className="text-muted-foreground text-xs">General info</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="warn" className="font-mono">
                    <div className="flex items-center gap-2">
                      <Badge variant="warning" className="text-xs">
                        warn
                      </Badge>
                      <span className="text-muted-foreground text-xs">Warnings only</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="error" className="font-mono">
                    <div className="flex items-center gap-2">
                      <Badge variant="destructive" className="text-xs">
                        error
                      </Badge>
                      <span className="text-muted-foreground text-xs">Errors only</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="file" className="text-foreground">
                Log File
                <span className="text-muted-foreground ml-2 text-xs">Path to output file</span>
              </Label>
              <Input
                id="file"
                type="text"
                value={config.logging.file}
                onChange={(e) => {
                  onChange({
                    ...config,
                    logging: { ...config.logging, file: e.target.value },
                  });
                }}
                placeholder="./debug.log"
              />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
