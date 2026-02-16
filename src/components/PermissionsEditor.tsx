// src/components/PermissionsEditor.tsx
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, ChevronRight, Shield, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';

interface PermissionsEditorProps {
  schema: Record<string, any>;
  value: Record<string, any>;
  onChange: (permissions: Record<string, any>) => void;
  disabled?: boolean;
}

export const PermissionsEditor: React.FC<PermissionsEditorProps> = ({
  schema,
  value = {},
  onChange,
  disabled = false,
}) => {
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());
  const [expandedResources, setExpandedResources] = useState<Set<string>>(new Set());

  // Initialize with all modules and resources expanded
  useEffect(() => {
    const modules = Object.keys(schema);
    setExpandedModules(new Set(modules));

    const resources: string[] = [];
    modules.forEach((module) => {
      if (schema[module]?.resources) {
        Object.keys(schema[module].resources).forEach((resource) => {
          resources.push(`${module}.${resource}`);
        });
      }
    });
    setExpandedResources(new Set(resources));
  }, [schema]);

  const toggleModule = (moduleKey: string) => {
    setExpandedModules((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(moduleKey)) {
        newSet.delete(moduleKey);
      } else {
        newSet.add(moduleKey);
      }
      return newSet;
    });
  };

  const toggleResource = (resourceKey: string) => {
    setExpandedResources((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(resourceKey)) {
        newSet.delete(resourceKey);
      } else {
        newSet.add(resourceKey);
      }
      return newSet;
    });
  };

  const updatePermission = (
    moduleKey: string,
    resourceKey: string,
    actionKey: string,
    actionValue: boolean | string
  ) => {
    const newPermissions = { ...value };

    // Initialize nested structure if it doesn't exist
    if (!newPermissions[moduleKey]) {
      newPermissions[moduleKey] = {};
    }
    if (!newPermissions[moduleKey][resourceKey]) {
      newPermissions[moduleKey][resourceKey] = {};
    }

    // Set the permission value
    newPermissions[moduleKey][resourceKey][actionKey] = actionValue;

    onChange(newPermissions);
  };

  const getPermissionValue = (
    moduleKey: string,
    resourceKey: string,
    actionKey: string
  ): boolean | string | undefined => {
    return value?.[moduleKey]?.[resourceKey]?.[actionKey];
  };

  // Bulk Actions
  const grantAllPermissions = () => {
    const newPermissions: Record<string, any> = {};

    Object.entries(schema).forEach(([moduleKey, moduleConfig]: [string, any]) => {
      newPermissions[moduleKey] = {};

      Object.entries(moduleConfig.resources || {}).forEach(([resourceKey, resourceConfig]: [string, any]) => {
        newPermissions[moduleKey][resourceKey] = {};

        Object.entries(resourceConfig.actions || {}).forEach(([actionKey, actionConfig]: [string, any]) => {
          if (actionConfig.type === 'boolean') {
            newPermissions[moduleKey][resourceKey][actionKey] = true;
          } else if (actionConfig.type === 'scope') {
            newPermissions[moduleKey][resourceKey][actionKey] = 'all';
          }
        });
      });
    });

    onChange(newPermissions);
  };

  const clearAllPermissions = () => {
    onChange({});
  };

  const grantModulePermissions = (moduleKey: string) => {
    const newPermissions = { ...value };
    const moduleConfig = schema[moduleKey];

    if (!newPermissions[moduleKey]) {
      newPermissions[moduleKey] = {};
    }

    Object.entries(moduleConfig.resources || {}).forEach(([resourceKey, resourceConfig]: [string, any]) => {
      newPermissions[moduleKey][resourceKey] = {};

      Object.entries(resourceConfig.actions || {}).forEach(([actionKey, actionConfig]: [string, any]) => {
        if (actionConfig.type === 'boolean') {
          newPermissions[moduleKey][resourceKey][actionKey] = true;
        } else if (actionConfig.type === 'scope') {
          newPermissions[moduleKey][resourceKey][actionKey] = 'all';
        }
      });
    });

    onChange(newPermissions);
  };

  const clearModulePermissions = (moduleKey: string) => {
    const newPermissions = { ...value };
    delete newPermissions[moduleKey];
    onChange(newPermissions);
  };

  const grantResourcePermissions = (moduleKey: string, resourceKey: string, scope: 'own' | 'team' | 'all' = 'all') => {
    const newPermissions = { ...value };
    const resourceConfig = schema[moduleKey]?.resources?.[resourceKey];

    if (!newPermissions[moduleKey]) {
      newPermissions[moduleKey] = {};
    }
    newPermissions[moduleKey][resourceKey] = {};

    Object.entries(resourceConfig.actions || {}).forEach(([actionKey, actionConfig]: [string, any]) => {
      if (actionConfig.type === 'boolean') {
        newPermissions[moduleKey][resourceKey][actionKey] = true;
      } else if (actionConfig.type === 'scope') {
        newPermissions[moduleKey][resourceKey][actionKey] = scope;
      }
    });

    onChange(newPermissions);
  };

  const clearResourcePermissions = (moduleKey: string, resourceKey: string) => {
    const newPermissions = { ...value };
    if (newPermissions[moduleKey]) {
      delete newPermissions[moduleKey][resourceKey];
    }
    onChange(newPermissions);
  };

  const renderAction = (
    moduleKey: string,
    resourceKey: string,
    actionKey: string,
    actionConfig: any
  ) => {
    const currentValue = getPermissionValue(moduleKey, resourceKey, actionKey);

    if (actionConfig.type === 'boolean') {
      return (
        <div key={actionKey} className="flex items-center justify-between py-2 px-3 hover:bg-muted/50 rounded">
          <Label htmlFor={`${moduleKey}-${resourceKey}-${actionKey}`} className="text-sm capitalize cursor-pointer">
            {actionKey.replace(/_/g, ' ')}
          </Label>
          <Checkbox
            id={`${moduleKey}-${resourceKey}-${actionKey}`}
            checked={currentValue === true}
            onCheckedChange={(checked) => {
              updatePermission(moduleKey, resourceKey, actionKey, checked === true);
            }}
            disabled={disabled}
          />
        </div>
      );
    }

    if (actionConfig.type === 'scope') {
      return (
        <div key={actionKey} className="flex items-center justify-between py-2 px-3 hover:bg-muted/50 rounded">
          <Label htmlFor={`${moduleKey}-${resourceKey}-${actionKey}`} className="text-sm capitalize">
            {actionKey.replace(/_/g, ' ')}
          </Label>
          <div className="flex items-center gap-2">
            <Select
              value={typeof currentValue === 'string' && currentValue !== '' ? currentValue : undefined}
              onValueChange={(newValue) => {
                updatePermission(moduleKey, resourceKey, actionKey, newValue);
              }}
              disabled={disabled}
            >
              <SelectTrigger className="w-32 h-8">
                <SelectValue placeholder="Select scope" />
              </SelectTrigger>
              <SelectContent>
                {actionConfig.options.map((option: string) => (
                  <SelectItem key={option} value={option}>
                    <span className="capitalize">{option}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {/* Clear button */}
            {currentValue && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => {
                  // Remove the permission by deleting the key
                  const newPermissions = { ...value };
                  if (newPermissions[moduleKey]?.[resourceKey]) {
                    delete newPermissions[moduleKey][resourceKey][actionKey];
                    onChange(newPermissions);
                  }
                }}
                disabled={disabled}
              >
                <span className="sr-only">Clear</span>
                ×
              </Button>
            )}
          </div>
        </div>
      );
    }

    return null;
  };

  if (!schema || Object.keys(schema).length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Loading permissions schema...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Super Admin / Bulk Actions */}
      <Card className="border-2 border-purple-200 bg-purple-50/50">
        <CardHeader className="py-3 px-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-purple-600" />
              <CardTitle className="text-base">Bulk Actions</CardTitle>
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <div className="flex flex-wrap gap-2">
            <Button
              variant="default"
              size="sm"
              onClick={grantAllPermissions}
              disabled={disabled}
              className="bg-purple-600 hover:bg-purple-700"
            >
              <Shield className="h-4 w-4 mr-2" />
              Grant All (Super Admin)
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={clearAllPermissions}
              disabled={disabled}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Clear All
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Grant all permissions across all modules or clear everything at once
          </p>
        </CardContent>
      </Card>

      {/* Modules */}
      {Object.entries(schema).map(([moduleKey, moduleConfig]: [string, any]) => {
        const isModuleExpanded = expandedModules.has(moduleKey);

        return (
          <Card key={moduleKey}>
            <CardHeader className="py-3 px-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 cursor-pointer" onClick={() => toggleModule(moduleKey)}>
                  {isModuleExpanded ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                  <CardTitle className="text-base">{moduleConfig.label || moduleKey}</CardTitle>
                  <Badge variant="outline" className="text-xs">
                    {Object.keys(moduleConfig.resources || {}).length} resources
                  </Badge>
                </div>

                {/* Module Bulk Actions */}
                <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => grantModulePermissions(moduleKey)}
                    disabled={disabled}
                  >
                    Grant All
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => clearModulePermissions(moduleKey)}
                    disabled={disabled}
                  >
                    Clear
                  </Button>
                </div>
              </div>
            </CardHeader>

            {isModuleExpanded && (
              <CardContent className="px-4 pb-4 space-y-3">
                {Object.entries(moduleConfig.resources || {}).map(
                  ([resourceKey, resourceConfig]: [string, any]) => {
                    const resourceFullKey = `${moduleKey}.${resourceKey}`;
                    const isResourceExpanded = expandedResources.has(resourceFullKey);

                    return (
                      <div key={resourceKey} className="border rounded-lg">
                        <div className="p-3 bg-muted/30">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 cursor-pointer flex-1" onClick={() => toggleResource(resourceFullKey)}>
                              {isResourceExpanded ? (
                                <ChevronDown className="h-3 w-3" />
                              ) : (
                                <ChevronRight className="h-3 w-3" />
                              )}
                              <span className="font-medium text-sm">
                                {resourceConfig.label || resourceKey}
                              </span>
                              <Badge variant="secondary" className="text-xs">
                                {Object.keys(resourceConfig.actions || {}).length} actions
                              </Badge>
                            </div>

                            {/* Resource Bulk Actions */}
                            <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-xs"
                                onClick={() => grantResourcePermissions(moduleKey, resourceKey, 'own')}
                                disabled={disabled}
                                title="Grant all with 'own' scope"
                              >
                                Own
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-xs"
                                onClick={() => grantResourcePermissions(moduleKey, resourceKey, 'team')}
                                disabled={disabled}
                                title="Grant all with 'team' scope"
                              >
                                Team
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-xs"
                                onClick={() => grantResourcePermissions(moduleKey, resourceKey, 'all')}
                                disabled={disabled}
                                title="Grant all with 'all' scope"
                              >
                                All
                              </Button>
                              <Separator orientation="vertical" className="h-4 mx-1" />
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0"
                                onClick={() => clearResourcePermissions(moduleKey, resourceKey)}
                                disabled={disabled}
                                title="Clear all permissions"
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        </div>

                        {isResourceExpanded && (
                          <div className="px-3 pb-2 space-y-1">
                            {Object.entries(resourceConfig.actions || {}).map(
                              ([actionKey, actionConfig]: [string, any]) =>
                                renderAction(moduleKey, resourceKey, actionKey, actionConfig)
                            )}
                          </div>
                        )}
                      </div>
                    );
                  }
                )}
              </CardContent>
            )}
          </Card>
        );
      })}
    </div>
  );
};
