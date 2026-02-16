// src/pages/FlowEditor.tsx
import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useFlow, useFlowMutations } from '@/hooks/whatsapp/useFlows';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ArrowLeft, Save, Eye, CheckCircle2, Plus, Trash2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import type { FlowJSON, FlowCategory, FlowScreen, CreateFlowPayload, UpdateFlowPayload } from '@/types/whatsappTypes';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const EMPTY_FLOW: FlowJSON = {
  version: '3.0',
  screens: [
    {
      id: 'START',
      title: 'Welcome',
      terminal: true,
      layout: {
        type: 'SingleColumnLayout',
        children: [
          {
            type: 'Form',
            name: 'form',
            children: [
              {
                type: 'TextHeading',
                text: 'Welcome to our service!',
              },
            ],
          },
          {
            type: 'Footer',
            label: 'Continue',
            'on-click-action': {
              name: 'complete',
              payload: {},
            },
          },
        ],
      },
    },
  ],
};

export default function FlowEditor() {
  const navigate = useNavigate();
  const { flow_id } = useParams<{ flow_id: string }>();
  const isNewFlow = flow_id === 'new';

  const { flow, isLoading: loadingFlow } = useFlow(isNewFlow ? null : flow_id || null);
  const { createFlow, updateFlow, validateFlow } = useFlowMutations();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<FlowCategory>('OTHER');
  const [endpointUri, setEndpointUri] = useState('');
  const [flowJson, setFlowJson] = useState<FlowJSON>(EMPTY_FLOW);
  const [selectedScreenIndex, setSelectedScreenIndex] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [validationWarnings, setValidationWarnings] = useState<string[]>([]);

  useEffect(() => {
    if (flow && !isNewFlow) {
      setName(flow.name);
      setDescription(flow.description || '');
      setCategory(flow.category);
      setEndpointUri(flow.endpoint_uri || '');
      setFlowJson(flow.flow_json);
    }
  }, [flow, isNewFlow]);

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error('Flow name is required');
      return;
    }

    if (flowJson.screens.length === 0) {
      toast.error('At least one screen is required');
      return;
    }

    setIsSaving(true);
    try {
      if (isNewFlow) {
        const payload: CreateFlowPayload = {
          name,
          description: description || undefined,
          flow_json: flowJson,
          category,
          version: '3.0',
          endpoint_uri: endpointUri || undefined,
        };

        const created = await createFlow(payload);
        toast.success('Flow created successfully');
        navigate(`/whatsapp/flows/${created.flow_id}`);
      } else if (flow_id) {
        const payload: UpdateFlowPayload = {
          name,
          description: description || undefined,
          flow_json: flowJson,
          category,
          endpoint_uri: endpointUri || undefined,
        };

        await updateFlow(flow_id, payload);
        toast.success('Flow updated successfully');
      }
    } catch (error: any) {
      toast.error(error?.message || 'Failed to save flow');
    } finally {
      setIsSaving(false);
    }
  };

  const handleValidate = async () => {
    if (!flow_id || isNewFlow) {
      toast.error('Please save the flow first');
      return;
    }

    try {
      const result = await validateFlow(flow_id);
      setValidationErrors(result.errors);
      setValidationWarnings(result.warnings);

      if (result.is_valid) {
        toast.success('Flow is valid!');
      } else {
        toast.error('Flow validation failed');
      }
    } catch (error: any) {
      toast.error(error?.message || 'Failed to validate flow');
    }
  };

  const handleAddScreen = () => {
    const newScreen: FlowScreen = {
      id: `SCREEN_${flowJson.screens.length + 1}`,
      title: `Screen ${flowJson.screens.length + 1}`,
      terminal: false,
      layout: {
        type: 'SingleColumnLayout',
        children: [
          {
            type: 'Form',
            name: 'form',
            children: [],
          },
          {
            type: 'Footer',
            label: 'Continue',
            'on-click-action': {
              name: 'navigate',
              next: { name: 'START' },
              payload: {},
            },
          },
        ],
      },
    };

    setFlowJson({
      ...flowJson,
      screens: [...flowJson.screens, newScreen],
    });
    setSelectedScreenIndex(flowJson.screens.length);
  };

  const handleDeleteScreen = (index: number) => {
    if (flowJson.screens.length === 1) {
      toast.error('Cannot delete the last screen');
      return;
    }

    const newScreens = flowJson.screens.filter((_, i) => i !== index);
    setFlowJson({ ...flowJson, screens: newScreens });
    setSelectedScreenIndex(Math.max(0, index - 1));
  };

  const handleUpdateScreen = (index: number, updates: Partial<FlowScreen>) => {
    const newScreens = [...flowJson.screens];
    newScreens[index] = { ...newScreens[index], ...updates };
    setFlowJson({ ...flowJson, screens: newScreens });
  };

  const handleAddComponent = (screenIndex: number, componentType: string) => {
    const screen = flowJson.screens[screenIndex];
    const form = screen.layout.children.find((c: any) => c.type === 'Form');

    if (!form) return;

    let newComponent: any = {};

    switch (componentType) {
      case 'TextHeading':
        newComponent = { type: 'TextHeading', text: 'Heading Text' };
        break;
      case 'TextBody':
        newComponent = { type: 'TextBody', text: 'Body text' };
        break;
      case 'TextInput':
        newComponent = {
          type: 'TextInput',
          name: `input_${Date.now()}`,
          label: 'Input Label',
          required: false,
          'input-type': 'text',
        };
        break;
      case 'TextArea':
        newComponent = {
          type: 'TextArea',
          name: `textarea_${Date.now()}`,
          label: 'Text Area Label',
          required: false,
        };
        break;
      case 'Dropdown':
        newComponent = {
          type: 'Dropdown',
          name: `dropdown_${Date.now()}`,
          label: 'Dropdown Label',
          required: false,
          'data-source': [
            { id: '1', title: 'Option 1' },
            { id: '2', title: 'Option 2' },
          ],
        };
        break;
      case 'OptIn':
        newComponent = {
          type: 'OptIn',
          name: `optin_${Date.now()}`,
          label: 'I agree to terms',
          required: false,
        };
        break;
      default:
        return;
    }

    const newScreens = [...flowJson.screens];
    const newForm = { ...form };
    newForm.children = [...(form.children || []), newComponent];

    const newLayout = { ...screen.layout };
    newLayout.children = screen.layout.children.map((c: any) =>
      c.type === 'Form' ? newForm : c
    );

    newScreens[screenIndex] = { ...screen, layout: newLayout };
    setFlowJson({ ...flowJson, screens: newScreens });
  };

  if (loadingFlow && !isNewFlow) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading flow...</p>
        </div>
      </div>
    );
  }

  const currentScreen = flowJson.screens[selectedScreenIndex];
  const formComponents = currentScreen?.layout?.children?.find((c: any) => c.type === 'Form')?.children || [];

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-background sticky top-0 z-10">
        <div className="flex items-center justify-between px-4 py-3 md:px-6">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/whatsapp/flows')}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-xl font-semibold">
                {isNewFlow ? 'Create New Flow' : `Edit: ${flow?.name || 'Flow'}`}
              </h1>
              <p className="text-xs text-muted-foreground">
                {flowJson.screens.length} screen{flowJson.screens.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleValidate} disabled={isNewFlow}>
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Validate
            </Button>
            <Button size="sm" onClick={handleSave} disabled={isSaving}>
              <Save className="h-4 w-4 mr-2" />
              {isSaving ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-hidden flex">
        {/* Left Sidebar - Flow Settings */}
        <div className="w-80 border-r overflow-y-auto p-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Flow Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="name">Flow Name *</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter flow name"
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Enter flow description"
                  rows={3}
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="category">Category *</Label>
                <Select value={category} onValueChange={(value: any) => setCategory(value)}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SIGN_UP">Sign Up</SelectItem>
                    <SelectItem value="SIGN_IN">Sign In</SelectItem>
                    <SelectItem value="APPOINTMENT_BOOKING">Appointment Booking</SelectItem>
                    <SelectItem value="LEAD_GENERATION">Lead Generation</SelectItem>
                    <SelectItem value="CONTACT_US">Contact Us</SelectItem>
                    <SelectItem value="CUSTOMER_SUPPORT">Customer Support</SelectItem>
                    <SelectItem value="SURVEY">Survey</SelectItem>
                    <SelectItem value="OTHER">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="endpoint">Endpoint URI (Optional)</Label>
                <Input
                  id="endpoint"
                  value={endpointUri}
                  onChange={(e) => setEndpointUri(e.target.value)}
                  placeholder="https://api.example.com/webhook"
                  className="mt-1"
                />
              </div>
            </CardContent>
          </Card>

          {/* Validation Results */}
          {(validationErrors.length > 0 || validationWarnings.length > 0) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Validation Results</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {validationErrors.length > 0 && (
                  <div className="space-y-1">
                    <div className="text-xs font-medium text-destructive">Errors:</div>
                    {validationErrors.map((error, i) => (
                      <div key={i} className="text-xs text-destructive flex items-start gap-2">
                        <AlertTriangle className="h-3 w-3 mt-0.5 flex-shrink-0" />
                        <span>{error}</span>
                      </div>
                    ))}
                  </div>
                )}
                {validationWarnings.length > 0 && (
                  <div className="space-y-1">
                    <div className="text-xs font-medium text-yellow-600">Warnings:</div>
                    {validationWarnings.map((warning, i) => (
                      <div key={i} className="text-xs text-yellow-600 flex items-start gap-2">
                        <AlertTriangle className="h-3 w-3 mt-0.5 flex-shrink-0" />
                        <span>{warning}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Main Editor Area */}
        <div className="flex-1 overflow-y-auto p-4">
          <Tabs value={`screen-${selectedScreenIndex}`} className="w-full">
            <div className="flex items-center justify-between mb-4">
              <TabsList>
                {flowJson.screens.map((screen, index) => (
                  <TabsTrigger
                    key={index}
                    value={`screen-${index}`}
                    onClick={() => setSelectedScreenIndex(index)}
                  >
                    {screen.id}
                  </TabsTrigger>
                ))}
              </TabsList>
              <Button size="sm" onClick={handleAddScreen}>
                <Plus className="h-4 w-4 mr-2" />
                Add Screen
              </Button>
            </div>

            {flowJson.screens.map((screen, index) => (
              <TabsContent key={index} value={`screen-${index}`} className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm flex items-center justify-between">
                      <span>Screen Settings</span>
                      {flowJson.screens.length > 1 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteScreen(index)}
                          className="text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label>Screen ID</Label>
                      <Input
                        value={screen.id}
                        onChange={(e) => handleUpdateScreen(index, { id: e.target.value })}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label>Screen Title</Label>
                      <Input
                        value={screen.title}
                        onChange={(e) => handleUpdateScreen(index, { title: e.target.value })}
                        className="mt-1"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id={`terminal-${index}`}
                        checked={screen.terminal || false}
                        onChange={(e) => handleUpdateScreen(index, { terminal: e.target.checked })}
                        className="rounded"
                      />
                      <Label htmlFor={`terminal-${index}`} className="cursor-pointer">
                        Terminal Screen (Last screen)
                      </Label>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Components</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" onClick={() => handleAddComponent(index, 'TextHeading')}>
                        + Heading
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => handleAddComponent(index, 'TextBody')}>
                        + Text
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => handleAddComponent(index, 'TextInput')}>
                        + Input
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => handleAddComponent(index, 'TextArea')}>
                        + TextArea
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => handleAddComponent(index, 'Dropdown')}>
                        + Dropdown
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => handleAddComponent(index, 'OptIn')}>
                        + Checkbox
                      </Button>
                    </div>

                    <Separator />

                    <div className="space-y-2">
                      <div className="text-sm font-medium">Current Components:</div>
                      {formComponents.length === 0 ? (
                        <div className="text-sm text-muted-foreground">No components added yet</div>
                      ) : (
                        formComponents.map((component: any, compIndex: number) => (
                          <div key={compIndex} className="border rounded p-3 space-y-2">
                            <div className="flex items-center justify-between">
                              <Badge variant="secondary">{component.type}</Badge>
                            </div>
                            <div className="text-xs">
                              <pre className="bg-muted p-2 rounded overflow-x-auto">
                                {JSON.stringify(component, null, 2)}
                              </pre>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            ))}
          </Tabs>
        </div>

        {/* Right Sidebar - JSON Preview */}
        <div className="w-96 border-l overflow-y-auto p-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Flow JSON Preview</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="text-xs bg-muted p-4 rounded overflow-x-auto">
                {JSON.stringify(flowJson, null, 2)}
              </pre>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
