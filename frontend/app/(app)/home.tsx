import { useState, useEffect } from 'react';
import { Platform, StyleSheet, Modal, TextInput, TouchableOpacity, Alert, ScrollView, ActivityIndicator, KeyboardAvoidingView, View, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';

import ParallaxScrollView from '@/components/parallax-scroll-view';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { apiService, Template, TemplateField, TemplateRequest, Project, ProjectRequest, Report, ReportRequest } from '@/lib/api';
import { useThemeColor } from '@/hooks/use-theme-color';

export default function HomeScreen() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [projectModalVisible, setProjectModalVisible] = useState(false);
  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [editingReport, setEditingReport] = useState<Report | null>(null);
  const [formData, setFormData] = useState<TemplateRequest>({
    name: '',
    description: '',
    fields: [],
  });
  const [projectFormData, setProjectFormData] = useState<ProjectRequest>({
    name: '',
    description: '',
    template: 0,
  });
  const [reportFormData, setReportFormData] = useState<ReportRequest>({
    project: 0,
    data: {},
  });
  const [selectedProjectForReport, setSelectedProjectForReport] = useState<Project | null>(null);
  const [choiceInputs, setChoiceInputs] = useState<Record<number, string>>({});
  const [templatePickerVisible, setTemplatePickerVisible] = useState(false);
  const [projectPickerVisible, setProjectPickerVisible] = useState(false);
  const [dateTimePickers, setDateTimePickers] = useState<Record<string, { showDate: boolean; showTime: boolean; date: Date }>>({});
  const [selectedProjectFilter, setSelectedProjectFilter] = useState<number | null>(null);
  const [projectFilterPickerVisible, setProjectFilterPickerVisible] = useState(false);
  const [selectedChoiceFieldFilter, setSelectedChoiceFieldFilter] = useState<{ fieldName: string; choices: string[] } | null>(null);
  const [selectedChoiceValueFilter, setSelectedChoiceValueFilter] = useState<string | null>(null);
  const [choiceFieldPickerVisible, setChoiceFieldPickerVisible] = useState(false);
  const [choiceValuePickerVisible, setChoiceValuePickerVisible] = useState(false);
  const [allReports, setAllReports] = useState<Report[]>([]); // Store unfiltered reports
  const [sortField, setSortField] = useState<string | null>('created_at'); // 'created_at' or datetime field name
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc'); // 'asc' or 'desc'
  const [sortFieldPickerVisible, setSortFieldPickerVisible] = useState(false);
  const [templatesExpanded, setTemplatesExpanded] = useState(false); // Collapsed by default
  const [projectsExpanded, setProjectsExpanded] = useState(false); // Collapsed by default
  const [reportsExpanded, setReportsExpanded] = useState(true); // Expanded by default
  const [fileDownloadUrls, setFileDownloadUrls] = useState<Record<string, Record<string, string>>>({}); // {fieldName: {fileKey: url}}
  const [uploadingFiles, setUploadingFiles] = useState<Record<string, boolean>>({}); // {fieldName: boolean}

  // Report management functions
  const openCreateReportModal = async () => {
    console.log('[Home] Opening create report modal');
    console.log('[Home] Current projects count:', projects.length);
    // Always reload projects to ensure we have the latest data
    await loadProjects();
    setEditingReport(null);
    setReportFormData({
      project: 0,
      data: {},
    });
    setSelectedProjectForReport(null);
    setReportModalVisible(true);
    console.log('[Home] Report modal visible:', true);
  };

  const openEditReportModal = async (report: Report) => {
    setEditingReport(report);
    const reportData = report.data || {};
    setReportFormData({
      project: report.project,
      data: reportData,
    });
    
    // Find the project to get template fields
    const project = projects.find(p => p.id === report.project);
    setSelectedProjectForReport(project || null);
    
    // Load download URLs for file fields
    loadFileDownloadUrls(reportData);
    
    setReportModalVisible(true);
  };

  const closeReportModal = () => {
    console.log('[Home] Closing report modal');
    setReportModalVisible(false);
    setEditingReport(null);
    setReportFormData({
      project: 0,
      data: {},
    });
    setSelectedProjectForReport(null);
    console.log('[Home] Report modal visible:', false);
    console.log('[Home] Current modal states:', {
      modalVisible,
      projectModalVisible,
      reportModalVisible: false,
      templatePickerVisible,
      projectPickerVisible,
    });
  };

  const handleProjectSelectForReport = (project: Project) => {
    console.log('[Home] handleProjectSelectForReport called with project:', project);
    console.log('[Home] Current reportFormData:', reportFormData);
    
    // Initialize data object with empty values for each template field
    const templateFields = templates.find(t => t.id === project.template)?.fields || [];
    console.log('[Home] Template fields found:', templateFields.length);
    const initialData: Record<string, any> = {};
    templateFields.forEach(field => {
      if (field.name && !reportFormData.data[field.name]) {
        // Initialize file fields as empty arrays, others as empty strings
        initialData[field.name] = field.type === 'file' ? [] : '';
      } else if (field.name && field.type === 'file' && !Array.isArray(reportFormData.data[field.name])) {
        // Ensure file fields are arrays
        initialData[field.name] = [];
      }
    });
    
    const newFormData = {
      project: project.id,
      data: { ...reportFormData.data, ...initialData },
    };
    
    console.log('[Home] Setting new reportFormData:', newFormData);
    setReportFormData(newFormData);
    setSelectedProjectForReport(project);
    console.log('[Home] Project selected:', project.name);
    
    // Load download URLs for existing file fields
    loadFileDownloadUrls(newFormData.data);
  };

  const handleReportFieldChange = (fieldName: string, value: any) => {
    setReportFormData({
      ...reportFormData,
      data: {
        ...reportFormData.data,
        [fieldName]: value,
      },
    });
  };

  const handleSaveReport = async () => {
    if (!reportFormData.project || reportFormData.project === 0) {
      Alert.alert('Error', 'Please select a project');
      return;
    }

    try {
      let response;
      if (editingReport) {
        response = await apiService.updateReport(editingReport.id, reportFormData);
      } else {
        response = await apiService.createReport(reportFormData);
      }

      if (response.success) {
        Alert.alert('Success', editingReport ? 'Report updated successfully' : 'Report created successfully');
        closeReportModal();
        loadReports();
      } else {
        const errorMessage = response.errors
          ? Object.values(response.errors).flat().join('\n')
          : response.message || 'Failed to save report';
        Alert.alert('Error', errorMessage);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to save report');
    }
  };

  const handleDeleteReport = (report: Report) => {
    Alert.alert(
      'Delete Report',
      `Are you sure you want to delete this report?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const response = await apiService.deleteReport(report.id);
              if (response.success) {
                Alert.alert('Success', 'Report deleted successfully');
                loadReports(selectedProjectFilter);
              } else {
                Alert.alert('Error', response.message || 'Failed to delete report');
              }
            } catch (error) {
              Alert.alert('Error', 'Failed to delete report');
            }
          },
        },
      ]
    );
  };

  // Get template fields for the selected project
  const getTemplateFields = (): TemplateField[] => {
    if (!selectedProjectForReport) return [];
    const projectTemplate = templates.find(t => t.id === selectedProjectForReport.template);
    return projectTemplate?.fields || [];
  };

  // Load download URLs for file fields
  const loadFileDownloadUrls = async (data: Record<string, any>) => {
    const urls: Record<string, Record<string, string>> = {};
    
    for (const [fieldName, fieldValue] of Object.entries(data)) {
      if (Array.isArray(fieldValue) && fieldValue.length > 0) {
        // Check if this is a file field by looking at template
        const templateFields = getTemplateFields();
        const field = templateFields.find(f => f.name === fieldName);
        if (field && field.type === 'file') {
          urls[fieldName] = {};
          for (const fileKey of fieldValue) {
            if (typeof fileKey === 'string') {
              try {
                const response = await apiService.getDownloadUrl({ file_key: fileKey });
                if (response.success && response.data?.url) {
                  urls[fieldName][fileKey] = response.data.url;
                }
              } catch (error) {
                console.error(`Failed to get download URL for ${fileKey}:`, error);
              }
            }
          }
        }
      }
    }
    
    setFileDownloadUrls(prev => ({ ...prev, ...urls }));
  };

  // Handle file upload
  const handleFileUpload = async (fieldName: string) => {
    try {
      // Request permissions
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'We need camera roll permissions to upload photos.');
        return;
      }

      // Pick image
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        quality: 0.8,
      });

      if (result.canceled) {
        return;
      }

      const images = result.assets || [];
      if (images.length === 0) {
        return;
      }

      setUploadingFiles(prev => ({ ...prev, [fieldName]: true }));

      const uploadedFileKeys: string[] = [];
      const newUrls: Record<string, string> = {};

      for (const image of images) {
        try {
          const filename = image.uri.split('/').pop() || `photo_${Date.now()}.jpg`;
          const fileExtension = filename.split('.').pop()?.toLowerCase() || 'jpg';
          let contentType = 'image/jpeg';
          if (fileExtension === 'png') {
            contentType = 'image/png';
          } else if (fileExtension === 'webp') {
            contentType = 'image/webp';
          }

          const uploadUrlResponse = await apiService.getUploadUrl({
            field_name: fieldName,
            filename: filename,
            content_type: contentType,
          });

          if (!uploadUrlResponse.success || !uploadUrlResponse.data) {
            throw new Error(uploadUrlResponse.message || 'Failed to get upload URL');
          }

          const { upload_url, file_key } = uploadUrlResponse.data;

          // Read file as blob (works for file:// and content:// URIs in React Native)
          const fileResponse = await fetch(image.uri);
          const blob = await fileResponse.blob();

          const uploadResponse = await fetch(upload_url, {
            method: 'PUT',
            body: blob,
            headers: {
              'Content-Type': contentType,
            },
          });

          if (!uploadResponse.ok) {
            const errText = await uploadResponse.text();
            throw new Error(`Upload failed: ${uploadResponse.status} ${uploadResponse.statusText}${errText ? ` - ${errText}` : ''}`);
          }

          uploadedFileKeys.push(file_key);

          // Get download URL for preview
          const downloadUrlResponse = await apiService.getDownloadUrl({ file_key });
          if (downloadUrlResponse.success && downloadUrlResponse.data?.url) {
            newUrls[file_key] = downloadUrlResponse.data.url;
          }
        } catch (error) {
          console.error('Error uploading file:', error);
          Alert.alert('Upload Error', `Failed to upload ${image.uri.split('/').pop()}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      // Update form data with new file keys
      const currentFiles = (reportFormData.data[fieldName] as string[]) || [];
      const updatedFiles = [...currentFiles, ...uploadedFileKeys];
      
      handleReportFieldChange(fieldName, updatedFiles);

      // Update download URLs
      setFileDownloadUrls(prev => ({
        ...prev,
        [fieldName]: {
          ...(prev[fieldName] || {}),
          ...newUrls,
        },
      }));

      setUploadingFiles(prev => ({ ...prev, [fieldName]: false }));
      
      if (uploadedFileKeys.length > 0) {
        Alert.alert('Success', `Successfully uploaded ${uploadedFileKeys.length} photo(s)`);
      }
    } catch (error) {
      console.error('Error in handleFileUpload:', error);
      setUploadingFiles(prev => ({ ...prev, [fieldName]: false }));
      Alert.alert('Error', `Failed to upload photos: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  // Remove file from field
  const handleRemoveFile = (fieldName: string, fileKey: string) => {
    const currentFiles = (reportFormData.data[fieldName] as string[]) || [];
    const updatedFiles = currentFiles.filter(key => key !== fileKey);
    handleReportFieldChange(fieldName, updatedFiles);
    
    // Remove from download URLs
    setFileDownloadUrls(prev => {
      const fieldUrls = { ...(prev[fieldName] || {}) };
      delete fieldUrls[fileKey];
      return {
        ...prev,
        [fieldName]: fieldUrls,
      };
    });
  };

  const backgroundColor = useThemeColor({}, 'background');
  const textColor = useThemeColor({}, 'text');
  const borderColor = useThemeColor({ light: '#ddd', dark: '#333' }, 'icon');
  const placeholderColor = useThemeColor({ light: '#999', dark: '#666' }, 'icon');

  useEffect(() => {
    console.log('[Home] Component mounted, loading data...');
    loadTemplates();
    loadProjects();
    loadReports(selectedProjectFilter);
  }, []);

  // Debug: Log modal states when they change
  useEffect(() => {
    console.log('[Home] Modal states changed:', {
      modalVisible,
      projectModalVisible,
      reportModalVisible,
      templatePickerVisible,
      projectPickerVisible,
    });
  }, [modalVisible, projectModalVisible, reportModalVisible, templatePickerVisible, projectPickerVisible]);

  const loadTemplates = async () => {
    console.log('[Home] Loading templates...');
    setLoading(true);
    try {
      const response = await apiService.getTemplates();
      console.log('[Home] Templates response:', response);
      if (response.success && Array.isArray(response.data)) {
        console.log('[Home] Loaded templates:', response.data.length);
        setTemplates(response.data);
      } else {
        console.error('[Home] Failed to load templates:', response.message);
        Alert.alert('Error', response.message || 'Failed to load templates');
      }
    } catch (error) {
      console.error('[Home] Error loading templates:', error);
      Alert.alert('Error', 'Failed to load templates');
    } finally {
      setLoading(false);
      console.log('[Home] Templates loading complete');
    }
  };

  const loadProjects = async () => {
    console.log('[Home] Loading projects...');
    setProjectsLoading(true);
    try {
      const response = await apiService.getProjects();
      console.log('[Home] Projects response:', response);
      if (response.success && Array.isArray(response.data)) {
        console.log('[Home] Loaded projects:', response.data.length);
        setProjects(response.data);
      } else {
        console.error('[Home] Failed to load projects:', response.message);
        Alert.alert('Error', response.message || 'Failed to load projects');
      }
    } catch (error) {
      console.error('[Home] Error loading projects:', error);
      Alert.alert('Error', 'Failed to load projects');
    } finally {
      setProjectsLoading(false);
      console.log('[Home] Projects loading complete');
    }
  };

  const loadReports = async (projectId?: number | null) => {
    setReportsLoading(true);
    try {
      const response = await apiService.getReports(projectId || undefined);
      if (response.success && Array.isArray(response.data)) {
        setAllReports(response.data); // Store all reports
        applyFilters(
          response.data,
          projectId || null,
          selectedChoiceFieldFilter,
          selectedChoiceValueFilter,
          sortField,
          sortDirection
        );
      } else {
        Alert.alert('Error', response.message || 'Failed to load reports');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to load reports');
    } finally {
      setReportsLoading(false);
    }
  };

  // Get all available choice fields from templates
  const getAvailableChoiceFields = (): Array<{ fieldName: string; choices: string[]; templateName: string }> => {
    const choiceFields: Array<{ fieldName: string; choices: string[]; templateName: string }> = [];
    
    // If a project filter is selected, only show choice fields from that project's template
    if (selectedProjectFilter) {
      const selectedProject = projects.find(p => p.id === selectedProjectFilter);
      if (selectedProject) {
        const projectTemplate = templates.find(t => t.id === selectedProject.template);
        if (projectTemplate) {
          projectTemplate.fields.forEach(field => {
            if (field.type === 'choice' && field.choices && field.choices.length > 0) {
              choiceFields.push({
                fieldName: field.name,
                choices: field.choices,
                templateName: projectTemplate.name,
              });
            }
          });
        }
      }
    } else {
      // Show choice fields from all templates
      templates.forEach(template => {
        template.fields.forEach(field => {
          if (field.type === 'choice' && field.choices && field.choices.length > 0) {
            choiceFields.push({
              fieldName: field.name,
              choices: field.choices,
              templateName: template.name,
            });
          }
        });
      });
    }
    
    return choiceFields;
  };

  // Get all available datetime fields from templates
  const getAvailableDateTimeFields = (): Array<{ fieldName: string; templateName: string }> => {
    const datetimeFields: Array<{ fieldName: string; templateName: string }> = [];
    
    // If a project filter is selected, only show datetime fields from that project's template
    if (selectedProjectFilter) {
      const selectedProject = projects.find(p => p.id === selectedProjectFilter);
      if (selectedProject) {
        const projectTemplate = templates.find(t => t.id === selectedProject.template);
        if (projectTemplate) {
          projectTemplate.fields.forEach(field => {
            if (field.type === 'datetime') {
              datetimeFields.push({
                fieldName: field.name,
                templateName: projectTemplate.name,
              });
            }
          });
        }
      }
    } else {
      // Show datetime fields from all templates
      templates.forEach(template => {
        template.fields.forEach(field => {
          if (field.type === 'datetime') {
            datetimeFields.push({
              fieldName: field.name,
              templateName: template.name,
            });
          }
        });
      });
    }
    
    return datetimeFields;
  };

  // Apply filters and sorting to reports
  const applyFilters = (
    reportsToFilter: Report[],
    projectFilter: number | null,
    choiceFieldFilter: { fieldName: string; choices: string[] } | null,
    choiceValueFilter: string | null,
    sortBy: string | null = null,
    sortDir: 'asc' | 'desc' = 'desc'
  ) => {
    let filtered = [...reportsToFilter];

    // Filter by project (already done server-side, but keep for consistency)
    if (projectFilter !== null) {
      filtered = filtered.filter(report => report.project === projectFilter);
    }

    // Filter by choice field value
    if (choiceFieldFilter && choiceValueFilter) {
      filtered = filtered.filter(report => {
        // Check if the report's data has the selected field with the selected value
        return report.data && report.data[choiceFieldFilter.fieldName] === choiceValueFilter;
      });
    }

    // Apply sorting
    if (sortBy) {
      filtered.sort((a, b) => {
        let aValue: Date | null = null;
        let bValue: Date | null = null;

        if (sortBy === 'created_at') {
          aValue = new Date(a.created_at);
          bValue = new Date(b.created_at);
        } else {
          // Sort by datetime field from report data
          const aDataValue = a.data?.[sortBy];
          const bDataValue = b.data?.[sortBy];
          
          if (aDataValue) {
            aValue = new Date(aDataValue);
          }
          if (bDataValue) {
            bValue = new Date(bDataValue);
          }
        }

        // Handle null/undefined values - put them at the end
        if (!aValue && !bValue) return 0;
        if (!aValue) return 1;
        if (!bValue) return -1;

        const comparison = aValue.getTime() - bValue.getTime();
        return sortDir === 'asc' ? comparison : -comparison;
      });
    } else {
      // Default sort by created_at descending if no sort field selected
      filtered.sort((a, b) => {
        const aDate = new Date(a.created_at);
        const bDate = new Date(b.created_at);
        return bDate.getTime() - aDate.getTime(); // Descending by default
      });
    }

    setReports(filtered);
  };

  // Clear choice filters when project filter changes if the choice field is not available in the new project
  useEffect(() => {
    if (selectedProjectFilter !== null && selectedChoiceFieldFilter) {
      const availableFields = getAvailableChoiceFields();
      const fieldStillAvailable = availableFields.some(
        f => f.fieldName === selectedChoiceFieldFilter.fieldName
      );
      if (!fieldStillAvailable) {
        // Clear choice filters if the selected field is not available in the filtered project
        setSelectedChoiceFieldFilter(null);
        setSelectedChoiceValueFilter(null);
        // Reapply filters without choice filters
        applyFilters(allReports, selectedProjectFilter, null, null, sortField, sortDirection);
      }
    } else if (selectedProjectFilter === null && selectedChoiceFieldFilter) {
      // When clearing project filter, reapply choice filters if they exist
      applyFilters(allReports, null, selectedChoiceFieldFilter, selectedChoiceValueFilter, sortField, sortDirection);
    }
  }, [selectedProjectFilter]);

  // Reapply filters when sort changes
  useEffect(() => {
    if (allReports.length > 0) {
      applyFilters(allReports, selectedProjectFilter, selectedChoiceFieldFilter, selectedChoiceValueFilter, sortField, sortDirection);
    }
  }, [sortField, sortDirection]);

  const openCreateModal = () => {
    console.log('[Home] Opening create template modal');
    setEditingTemplate(null);
    setFormData({
      name: '',
      description: '',
      fields: [],
    });
    setModalVisible(true);
    console.log('[Home] Template modal visible:', true);
  };

  const openEditModal = (template: Template) => {
    setEditingTemplate(template);
    setFormData({
      name: template.name,
      description: template.description,
      fields: template.fields,
    });
    setModalVisible(true);
  };

  const closeModal = () => {
    console.log('[Home] Closing template modal');
    setModalVisible(false);
    setEditingTemplate(null);
    setFormData({
      name: '',
      description: '',
      fields: [],
    });
    setChoiceInputs({});
    console.log('[Home] Template modal visible:', false);
  };

  const handleSave = async () => {
    console.log('[Home] Saving template:', { editingTemplate: !!editingTemplate, formData });
    if (!formData.name.trim()) {
      console.warn('[Home] Template name is required');
      Alert.alert('Error', 'Template name is required');
      return;
    }

    try {
      let response;
      if (editingTemplate) {
        console.log('[Home] Updating template:', editingTemplate.id);
        response = await apiService.updateTemplate(editingTemplate.id, formData);
      } else {
        console.log('[Home] Creating new template');
        response = await apiService.createTemplate(formData);
      }

      console.log('[Home] Template save response:', response);
      if (response.success) {
        console.log('[Home] Template saved successfully');
        Alert.alert('Success', editingTemplate ? 'Template updated successfully' : 'Template created successfully');
        closeModal();
        loadTemplates();
      } else {
        const errorMessage = response.errors
          ? Object.values(response.errors).flat().join('\n')
          : response.message || 'Failed to save template';
        console.error('[Home] Template save failed:', errorMessage);
        Alert.alert('Error', errorMessage);
      }
    } catch (error) {
      console.error('[Home] Error saving template:', error);
      Alert.alert('Error', 'Failed to save template');
    }
  };

  const handleDelete = (template: Template) => {
    Alert.alert(
      'Delete Template',
      `Are you sure you want to delete "${template.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const response = await apiService.deleteTemplate(template.id);
              if (response.success) {
                Alert.alert('Success', 'Template deleted successfully');
                loadTemplates();
              } else {
                Alert.alert('Error', response.message || 'Failed to delete template');
              }
            } catch (error) {
              Alert.alert('Error', 'Failed to delete template');
            }
          },
        },
      ]
    );
  };

  const addField = (type: 'text' | 'choice' | 'datetime' | 'file') => {
    const newField: TemplateField = {
      type,
      name: '',
      ...(type === 'choice' && { choices: [] }),
    };
    setFormData({
      ...formData,
      fields: [...formData.fields, newField],
    });
  };

  const updateField = (index: number, updates: Partial<TemplateField>) => {
    const updatedFields = [...formData.fields];
    updatedFields[index] = { ...updatedFields[index], ...updates };
    setFormData({ ...formData, fields: updatedFields });
  };

  const removeField = (index: number) => {
    const updatedFields = formData.fields.filter((_, i) => i !== index);
    setFormData({ ...formData, fields: updatedFields });
  };

  const addChoice = (fieldIndex: number, choice: string) => {
    if (!choice.trim()) return;
    const updatedFields = [...formData.fields];
    const field = updatedFields[fieldIndex];
    if (field.type === 'choice') {
      updatedFields[fieldIndex] = {
        ...field,
        choices: [...(field.choices || []), choice.trim()],
      };
      setFormData({ ...formData, fields: updatedFields });
      setChoiceInputs({ ...choiceInputs, [fieldIndex]: '' });
    }
  };

  const removeChoice = (fieldIndex: number, choiceIndex: number) => {
    const updatedFields = [...formData.fields];
    const field = updatedFields[fieldIndex];
    if (field.type === 'choice' && field.choices) {
      updatedFields[fieldIndex] = {
        ...field,
        choices: field.choices.filter((_, i) => i !== choiceIndex),
      };
      setFormData({ ...formData, fields: updatedFields });
    }
  };

  // Project management functions
  const openCreateProjectModal = () => {
    console.log('[Home] Opening create project modal');
    setEditingProject(null);
    setProjectFormData({
      name: '',
      description: '',
      template: templates.length > 0 ? templates[0].id : 0,
    });
    setProjectModalVisible(true);
    console.log('[Home] Project modal visible:', true);
  };

  const openEditProjectModal = (project: Project) => {
    setEditingProject(project);
    setProjectFormData({
      name: project.name,
      description: project.description,
      template: project.template,
    });
    setProjectModalVisible(true);
  };

  const closeProjectModal = () => {
    console.log('[Home] Closing project modal');
    setProjectModalVisible(false);
    setEditingProject(null);
    setProjectFormData({
      name: '',
      description: '',
      template: 0,
    });
    setTemplatePickerVisible(false);
    console.log('[Home] Project modal visible:', false);
    console.log('[Home] Current modal states:', {
      modalVisible,
      projectModalVisible: false,
      reportModalVisible,
      templatePickerVisible: false,
      projectPickerVisible,
    });
  };

  const handleSaveProject = async () => {
    console.log('[Home] Saving project:', { editingProject: !!editingProject, projectFormData });
    if (!projectFormData.name.trim()) {
      console.warn('[Home] Project name is required');
      Alert.alert('Error', 'Project name is required');
      return;
    }

    if (!projectFormData.template || projectFormData.template === 0) {
      console.warn('[Home] Template is required');
      Alert.alert('Error', 'Please select a template');
      return;
    }

    try {
      let response;
      if (editingProject) {
        console.log('[Home] Updating project:', editingProject.id);
        response = await apiService.updateProject(editingProject.id, projectFormData);
      } else {
        console.log('[Home] Creating new project');
        response = await apiService.createProject(projectFormData);
      }

      console.log('[Home] Project save response:', response);
      if (response.success) {
        console.log('[Home] Project saved successfully');
        Alert.alert('Success', editingProject ? 'Project updated successfully' : 'Project created successfully');
        closeProjectModal();
        loadProjects();
      } else {
        const errorMessage = response.errors
          ? Object.values(response.errors).flat().join('\n')
          : response.message || 'Failed to save project';
        console.error('[Home] Project save failed:', errorMessage);
        Alert.alert('Error', errorMessage);
      }
    } catch (error) {
      console.error('[Home] Error saving project:', error);
      Alert.alert('Error', 'Failed to save project');
    }
  };

  const handleDeleteProject = (project: Project) => {
    Alert.alert(
      'Delete Project',
      `Are you sure you want to delete "${project.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const response = await apiService.deleteProject(project.id);
              if (response.success) {
                Alert.alert('Success', 'Project deleted successfully');
                loadProjects();
              } else {
                Alert.alert('Error', response.message || 'Failed to delete project');
              }
            } catch (error) {
              Alert.alert('Error', 'Failed to delete project');
            }
          },
        },
      ]
    );
  };

  return (
    <ParallaxScrollView
      headerBackgroundColor={{ light: '#FF6B35', dark: '#8B2E16' }}
      headerImage={
        <ThemedView style={styles.fireIconContainer}>
          <Ionicons name="flame" size={120} color="#FFFFFF" />
        </ThemedView>
      }>
      <TouchableOpacity 
        style={styles.sectionHeader}
        onPress={() => setTemplatesExpanded(!templatesExpanded)}
      >
        <ThemedText type="title">Templates</ThemedText>
        <Ionicons 
          name={templatesExpanded ? "chevron-down" : "chevron-forward"} 
          size={24} 
          color={textColor} 
        />
      </TouchableOpacity>

      {templatesExpanded && (
        <>
          <ThemedView style={styles.buttonContainer}>
        <TouchableOpacity 
          style={styles.createButton} 
          onPress={() => {
            console.log('[Home] Create Template button clicked');
            openCreateModal();
          }}
        >
          <Ionicons name="add" size={20} color="#fff" />
          <ThemedText style={styles.createButtonText}>Create Template</ThemedText>
        </TouchableOpacity>
      </ThemedView>

      {loading ? (
        <ThemedView style={styles.centerContainer}>
          <ActivityIndicator size="large" />
          <ThemedText style={styles.loadingText}>Loading templates...</ThemedText>
        </ThemedView>
      ) : templates.length === 0 ? (
        <ThemedView style={styles.centerContainer}>
          <ThemedText>No templates yet. Create your first template!</ThemedText>
        </ThemedView>
      ) : (
        <ThemedView style={styles.templatesContainer}>
          {templates.map((template) => (
            <ThemedView key={template.id} style={[styles.templateCard, { borderColor }]}>
              <ThemedView style={styles.templateHeader}>
                <ThemedText type="subtitle">{template.name}</ThemedText>
                <ThemedView style={styles.templateActions}>
                  <TouchableOpacity
                    style={styles.iconButton}
                    onPress={() => openEditModal(template)}
                  >
                    <Ionicons name="pencil" size={20} color="#0a7ea4" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.iconButton}
                    onPress={() => handleDelete(template)}
                  >
                    <Ionicons name="trash" size={20} color="#ff3b30" />
                  </TouchableOpacity>
                </ThemedView>
              </ThemedView>
              {template.description && (
                <ThemedText style={styles.templateDescription}>{template.description}</ThemedText>
              )}
              <ThemedText style={styles.fieldCount}>
                {template.fields.length} field{template.fields.length !== 1 ? 's' : ''}
              </ThemedText>
            </ThemedView>
          ))}
        </ThemedView>
      )}
        </>
      )}

      <TouchableOpacity 
        style={styles.sectionHeader}
        onPress={() => setProjectsExpanded(!projectsExpanded)}
      >
        <ThemedText type="title">Projects</ThemedText>
        <Ionicons 
          name={projectsExpanded ? "chevron-down" : "chevron-forward"} 
          size={24} 
          color={textColor} 
        />
      </TouchableOpacity>

      {projectsExpanded && (
        <>
          <ThemedView style={styles.buttonContainer}>
        <TouchableOpacity 
          style={styles.createButton} 
          onPress={() => {
            console.log('[Home] Create Project button clicked');
            openCreateProjectModal();
          }}
        >
          <Ionicons name="add" size={20} color="#fff" />
          <ThemedText style={styles.createButtonText}>Create Project</ThemedText>
        </TouchableOpacity>
      </ThemedView>

      {projectsLoading ? (
        <ThemedView style={styles.centerContainer}>
          <ActivityIndicator size="large" />
          <ThemedText style={styles.loadingText}>Loading projects...</ThemedText>
        </ThemedView>
      ) : projects.length === 0 ? (
        <ThemedView style={styles.centerContainer}>
          <ThemedText>No projects yet. Create your first project!</ThemedText>
        </ThemedView>
      ) : (
        <ThemedView style={styles.templatesContainer}>
          {projects.map((project) => (
            <ThemedView key={project.id} style={[styles.templateCard, { borderColor }]}>
              <ThemedView style={styles.templateHeader}>
                <ThemedView>
                  <ThemedText type="subtitle">{project.name}</ThemedText>
                  {project.template_name && (
                    <ThemedText style={styles.templateDescription}>
                      Template: {project.template_name}
                    </ThemedText>
                  )}
                </ThemedView>
                <ThemedView style={styles.templateActions}>
                  <TouchableOpacity
                    style={styles.iconButton}
                    onPress={() => openEditProjectModal(project)}
                  >
                    <Ionicons name="pencil" size={20} color="#0a7ea4" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.iconButton}
                    onPress={() => handleDeleteProject(project)}
                  >
                    <Ionicons name="trash" size={20} color="#ff3b30" />
                  </TouchableOpacity>
                </ThemedView>
              </ThemedView>
              {project.description && (
                <ThemedText style={styles.templateDescription}>{project.description}</ThemedText>
              )}
            </ThemedView>
          ))}
        </ThemedView>
      )}
        </>
      )}

      <TouchableOpacity 
        style={styles.sectionHeader}
        onPress={() => setReportsExpanded(!reportsExpanded)}
      >
        <ThemedText type="title">Reports</ThemedText>
        <Ionicons 
          name={reportsExpanded ? "chevron-down" : "chevron-forward"} 
          size={24} 
          color={textColor} 
        />
      </TouchableOpacity>

      {reportsExpanded && (
        <>
          <ThemedView style={styles.buttonContainer}>
        <TouchableOpacity 
          style={styles.createButton} 
          onPress={() => {
            console.log('[Home] Create Report button clicked');
            openCreateReportModal();
          }}
        >
          <Ionicons name="add" size={20} color="#fff" />
          <ThemedText style={styles.createButtonText}>Create Report</ThemedText>
        </TouchableOpacity>
      </ThemedView>

      <ThemedView style={styles.filterContainer}>
        {projects.length > 0 && (
          <ThemedView style={styles.inputContainer}>
            <ThemedText style={styles.label}>Filter by Project</ThemedText>
            <TouchableOpacity
              style={[styles.input, styles.pickerButton, { backgroundColor, borderColor }]}
              onPress={() => setProjectFilterPickerVisible(true)}
            >
              <ThemedText style={{ color: selectedProjectFilter ? textColor : placeholderColor }}>
                {selectedProjectFilter
                  ? projects.find(p => p.id === selectedProjectFilter)?.name || 'Select Project'
                  : 'All Projects'}
              </ThemedText>
              <Ionicons name="chevron-down" size={20} color={textColor} />
            </TouchableOpacity>
          </ThemedView>
        )}

        {getAvailableChoiceFields().length > 0 && (
          <>
            <ThemedView style={styles.inputContainer}>
              <ThemedText style={styles.label}>Filter by Choice Field</ThemedText>
              <TouchableOpacity
                style={[styles.input, styles.pickerButton, { backgroundColor, borderColor }]}
                onPress={() => setChoiceFieldPickerVisible(true)}
              >
                <ThemedText style={{ color: selectedChoiceFieldFilter ? textColor : placeholderColor }}>
                  {selectedChoiceFieldFilter ? selectedChoiceFieldFilter.fieldName : 'Select Field'}
                </ThemedText>
                <Ionicons name="chevron-down" size={20} color={textColor} />
              </TouchableOpacity>
            </ThemedView>

            {selectedChoiceFieldFilter && (
              <ThemedView style={styles.inputContainer}>
                <ThemedText style={styles.label}>Filter by Choice Value</ThemedText>
                <TouchableOpacity
                  style={[styles.input, styles.pickerButton, { backgroundColor, borderColor }]}
                  onPress={() => setChoiceValuePickerVisible(true)}
                >
                  <ThemedText style={{ color: selectedChoiceValueFilter ? textColor : placeholderColor }}>
                    {selectedChoiceValueFilter || 'Select Value'}
                  </ThemedText>
                  <Ionicons name="chevron-down" size={20} color={textColor} />
                </TouchableOpacity>
              </ThemedView>
            )}

            {(selectedChoiceFieldFilter || selectedChoiceValueFilter) && (
              <TouchableOpacity
                style={[styles.clearFilterButton, { borderColor }]}
                onPress={() => {
                  setSelectedChoiceFieldFilter(null);
                  setSelectedChoiceValueFilter(null);
                  applyFilters(allReports, selectedProjectFilter, null, null, sortField, sortDirection);
                }}
              >
                <Ionicons name="close-circle" size={16} color={textColor} />
                <ThemedText style={{ color: textColor, marginLeft: 4 }}>Clear Choice Filters</ThemedText>
              </TouchableOpacity>
            )}
          </>
        )}

        {(getAvailableDateTimeFields().length > 0 || true) && (
          <ThemedView style={styles.inputContainer}>
            <ThemedText style={styles.label}>Sort By</ThemedText>
            <TouchableOpacity
              style={[styles.input, styles.pickerButton, { backgroundColor, borderColor }]}
              onPress={() => setSortFieldPickerVisible(true)}
            >
              <ThemedText style={{ color: textColor }}>
                {sortField === 'created_at' 
                  ? 'Created At' 
                  : sortField 
                    ? getAvailableDateTimeFields().find(f => f.fieldName === sortField)?.fieldName || 'Select Field'
                    : 'Created At'}
              </ThemedText>
              <Ionicons name="chevron-down" size={20} color={textColor} />
            </TouchableOpacity>
          </ThemedView>
        )}

        <ThemedView style={styles.inputContainer}>
          <ThemedText style={styles.label}>Sort Direction</ThemedText>
            <ThemedView style={styles.sortDirectionContainer}>
              <TouchableOpacity
                style={[
                  styles.sortDirectionButton,
                  { backgroundColor: sortDirection === 'asc' ? '#0a7ea4' : backgroundColor, borderColor }
                ]}
                onPress={() => {
                  setSortDirection('asc');
                  applyFilters(allReports, selectedProjectFilter, selectedChoiceFieldFilter, selectedChoiceValueFilter, sortField, 'asc');
                }}
              >
                <Ionicons name="arrow-up" size={16} color={sortDirection === 'asc' ? '#fff' : textColor} />
                <ThemedText style={{ color: sortDirection === 'asc' ? '#fff' : textColor, marginLeft: 4 }}>
                  Ascending
                </ThemedText>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.sortDirectionButton,
                  { backgroundColor: sortDirection === 'desc' ? '#0a7ea4' : backgroundColor, borderColor }
                ]}
                onPress={() => {
                  setSortDirection('desc');
                  applyFilters(allReports, selectedProjectFilter, selectedChoiceFieldFilter, selectedChoiceValueFilter, sortField, 'desc');
                }}
              >
                <Ionicons name="arrow-down" size={16} color={sortDirection === 'desc' ? '#fff' : textColor} />
                <ThemedText style={{ color: sortDirection === 'desc' ? '#fff' : textColor, marginLeft: 4 }}>
                  Descending
                </ThemedText>
              </TouchableOpacity>
            </ThemedView>
          </ThemedView>
      </ThemedView>

      {reportsLoading ? (
        <ThemedView style={styles.centerContainer}>
          <ActivityIndicator size="large" />
          <ThemedText style={styles.loadingText}>Loading reports...</ThemedText>
        </ThemedView>
      ) : reports.length === 0 ? (
        <ThemedView style={styles.centerContainer}>
          <ThemedText>No reports yet. Create your first report!</ThemedText>
        </ThemedView>
      ) : (
        <ThemedView style={styles.templatesContainer}>
          {reports.map((report) => (
            <ThemedView key={report.id} style={[styles.templateCard, { borderColor }]}>
              <ThemedView style={styles.templateHeader}>
                <ThemedView>
                  <ThemedText type="subtitle">{report.project_name || `Report #${report.id}`}</ThemedText>
                  <ThemedText style={styles.templateDescription}>
                    {new Date(report.created_at).toLocaleDateString()}
                  </ThemedText>
                </ThemedView>
                <ThemedView style={styles.templateActions}>
                  <TouchableOpacity
                    style={styles.iconButton}
                    onPress={() => openEditReportModal(report)}
                  >
                    <Ionicons name="pencil" size={20} color="#0a7ea4" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.iconButton}
                    onPress={() => handleDeleteReport(report)}
                  >
                    <Ionicons name="trash" size={20} color="#ff3b30" />
                  </TouchableOpacity>
                </ThemedView>
              </ThemedView>
            </ThemedView>
          ))}
        </ThemedView>
      )}
        </>
      )}

      {/* Template Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={closeModal}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={0}
        >
          <ThemedView style={styles.modalContent} lightColor="#fff" darkColor="#1a1a1a">
            <ThemedView style={styles.modalHeader}>
              <ThemedText type="title">
                {editingTemplate ? 'Edit Template' : 'Create Template'}
              </ThemedText>
              <TouchableOpacity 
                onPress={() => {
                  console.log('[Home] Template modal close button clicked');
                  closeModal();
                }}
              >
                <Ionicons name="close" size={24} color={textColor} />
              </TouchableOpacity>
            </ThemedView>

            <ScrollView 
              style={styles.modalBody} 
              contentContainerStyle={styles.modalBodyContent}
              showsVerticalScrollIndicator={false}
            >
              <ThemedView style={styles.inputContainer}>
                <ThemedText style={styles.label}>Name *</ThemedText>
                <TextInput
                  style={[styles.input, { backgroundColor, color: textColor, borderColor }]}
                  placeholder="Template name"
                  placeholderTextColor={placeholderColor}
                  value={formData.name}
                  onChangeText={(text) => setFormData({ ...formData, name: text })}
                />
              </ThemedView>

              <ThemedView style={styles.inputContainer}>
                <ThemedText style={styles.label}>Description</ThemedText>
                <TextInput
                  style={[styles.textArea, { backgroundColor, color: textColor, borderColor }]}
                  placeholder="Template description"
                  placeholderTextColor={placeholderColor}
                  value={formData.description}
                  onChangeText={(text) => setFormData({ ...formData, description: text })}
                  multiline
                  numberOfLines={3}
                />
              </ThemedView>

              <ThemedView style={styles.inputContainer}>
                <ThemedText style={styles.label}>Fields</ThemedText>
                <ThemedView style={styles.addFieldButtons}>
                  <TouchableOpacity
                    style={[styles.addFieldButton, { borderColor }]}
                    onPress={() => addField('text')}
                  >
                    <Ionicons name="text" size={16} color={textColor} />
                    <ThemedText style={styles.addFieldButtonText}>Text</ThemedText>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.addFieldButton, { borderColor }]}
                    onPress={() => addField('datetime')}
                  >
                    <Ionicons name="calendar" size={16} color={textColor} />
                    <ThemedText style={styles.addFieldButtonText}>DateTime</ThemedText>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.addFieldButton, { borderColor }]}
                    onPress={() => addField('choice')}
                  >
                    <Ionicons name="list" size={16} color={textColor} />
                    <ThemedText style={styles.addFieldButtonText}>Choice</ThemedText>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.addFieldButton, { borderColor }]}
                    onPress={() => addField('file')}
                  >
                    <Ionicons name="camera-outline" size={16} color={textColor} />
                    <ThemedText style={styles.addFieldButtonText}>File</ThemedText>
                  </TouchableOpacity>
                </ThemedView>

                {formData.fields.map((field, index) => (
                  <ThemedView key={index} style={[styles.fieldCard, { borderColor }]}>
                    <ThemedView style={styles.fieldHeader}>
                      <ThemedText style={styles.fieldType}>
                        {field.type.charAt(0).toUpperCase() + field.type.slice(1)} Field
                      </ThemedText>
                      <TouchableOpacity onPress={() => removeField(index)}>
                        <Ionicons name="trash-outline" size={18} color="#ff3b30" />
                      </TouchableOpacity>
                    </ThemedView>
                    <TextInput
                      style={[styles.input, { backgroundColor, color: textColor, borderColor }]}
                      placeholder="Field name"
                      placeholderTextColor={placeholderColor}
                      value={field.name}
                      onChangeText={(text) => updateField(index, { name: text })}
                    />
                    {field.type === 'choice' && (
                      <ThemedView style={styles.choicesContainer}>
                        <ThemedText style={styles.choicesLabel}>Choices:</ThemedText>
                        {field.choices?.map((choice, choiceIndex) => (
                          <ThemedView key={choiceIndex} style={styles.choiceItem}>
                            <ThemedText style={styles.choiceText}>{choice}</ThemedText>
                            <TouchableOpacity
                              onPress={() => removeChoice(index, choiceIndex)}
                            >
                              <Ionicons name="close-circle" size={20} color="#ff3b30" />
                            </TouchableOpacity>
                          </ThemedView>
                        ))}
                        <TextInput
                          style={[styles.input, { backgroundColor, color: textColor, borderColor }]}
                          placeholder="Add choice and press Enter"
                          placeholderTextColor={placeholderColor}
                          value={choiceInputs[index] || ''}
                          onChangeText={(text) => setChoiceInputs({ ...choiceInputs, [index]: text })}
                          onSubmitEditing={(e) => {
                            addChoice(index, e.nativeEvent.text);
                          }}
                        />
                      </ThemedView>
                    )}
                  </ThemedView>
                ))}
              </ThemedView>

              <ThemedView style={[styles.modalActions, { borderTopColor: borderColor }]}>
                <TouchableOpacity
                  style={[styles.button, styles.cancelButton, { borderColor }]}
                  onPress={closeModal}
                >
                  <ThemedText style={styles.cancelButtonText}>Cancel</ThemedText>
                </TouchableOpacity>
                <TouchableOpacity style={styles.button} onPress={handleSave}>
                  <ThemedText style={styles.buttonText}>Save</ThemedText>
                </TouchableOpacity>
              </ThemedView>
            </ScrollView>
          </ThemedView>
        </KeyboardAvoidingView>
      </Modal>

      {/* Project Modal */}
      <Modal
        visible={projectModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={closeProjectModal}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={0}
        >
          <ThemedView style={styles.modalContent} lightColor="#fff" darkColor="#1a1a1a">
            <ThemedView style={styles.modalHeader}>
              <ThemedText type="title">
                {editingProject ? 'Edit Project' : 'Create Project'}
              </ThemedText>
              <TouchableOpacity 
                onPress={() => {
                  console.log('[Home] Project modal close button clicked');
                  closeProjectModal();
                }}
              >
                <Ionicons name="close" size={24} color={textColor} />
              </TouchableOpacity>
            </ThemedView>

            <ScrollView 
              style={styles.modalBody} 
              contentContainerStyle={styles.modalBodyContent}
              showsVerticalScrollIndicator={false}
            >
              <ThemedView style={styles.inputContainer}>
                <ThemedText style={styles.label}>Name *</ThemedText>
                <TextInput
                  style={[styles.input, { backgroundColor, color: textColor, borderColor }]}
                  placeholder="Project name"
                  placeholderTextColor={placeholderColor}
                  value={projectFormData.name}
                  onChangeText={(text) => setProjectFormData({ ...projectFormData, name: text })}
                />
              </ThemedView>

              <ThemedView style={styles.inputContainer}>
                <ThemedText style={styles.label}>Description</ThemedText>
                <TextInput
                  style={[styles.textArea, { backgroundColor, color: textColor, borderColor }]}
                  placeholder="Project description"
                  placeholderTextColor={placeholderColor}
                  value={projectFormData.description}
                  onChangeText={(text) => setProjectFormData({ ...projectFormData, description: text })}
                  multiline
                  numberOfLines={3}
                />
              </ThemedView>

              <ThemedView style={styles.inputContainer}>
                <ThemedText style={styles.label}>Template *</ThemedText>
                <TouchableOpacity
                  style={[styles.input, styles.pickerButton, { backgroundColor, borderColor }]}
                  onPress={() => setTemplatePickerVisible(true)}
                >
                  <ThemedText style={{ color: projectFormData.template ? textColor : placeholderColor }}>
                    {projectFormData.template
                      ? templates.find(t => t.id === projectFormData.template)?.name || 'Select template'
                      : 'Select template'}
                  </ThemedText>
                  <Ionicons name="chevron-down" size={20} color={textColor} />
                </TouchableOpacity>
              </ThemedView>

              <ThemedView style={styles.modalActions}>
                <TouchableOpacity
                  style={[styles.button, styles.cancelButton, { borderColor }]}
                  onPress={closeProjectModal}
                >
                  <ThemedText style={styles.cancelButtonText}>Cancel</ThemedText>
                </TouchableOpacity>
                <TouchableOpacity style={styles.button} onPress={handleSaveProject}>
                  <ThemedText style={styles.buttonText}>Save</ThemedText>
                </TouchableOpacity>
              </ThemedView>
            </ScrollView>
          </ThemedView>
        </KeyboardAvoidingView>
      </Modal>

      {/* Template Picker Modal */}
      <Modal
        visible={templatePickerVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setTemplatePickerVisible(false)}
      >
        <TouchableOpacity
          style={styles.pickerOverlay}
          activeOpacity={1}
          onPress={() => setTemplatePickerVisible(false)}
        >
          <ThemedView style={styles.pickerContainer} lightColor="#fff" darkColor="#1a1a1a">
            <ThemedView style={styles.pickerHeader}>
              <ThemedText type="subtitle">Select Template</ThemedText>
              <TouchableOpacity onPress={() => setTemplatePickerVisible(false)}>
                <Ionicons name="close" size={24} color={textColor} />
              </TouchableOpacity>
            </ThemedView>
            <ScrollView>
              {templates.map((template) => (
                <TouchableOpacity
                  key={template.id}
                  style={[
                    styles.pickerItem,
                    { borderBottomColor: borderColor },
                    projectFormData.template === template.id && styles.pickerItemSelected,
                  ]}
                  onPress={() => {
                    setProjectFormData({ ...projectFormData, template: template.id });
                    setTemplatePickerVisible(false);
                  }}
                >
                  <ThemedText>{template.name}</ThemedText>
                  {projectFormData.template === template.id && (
                    <Ionicons name="checkmark" size={20} color="#0a7ea4" />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </ThemedView>
        </TouchableOpacity>
      </Modal>

      {/* Report Modal */}
      <Modal
        visible={reportModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={closeReportModal}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={0}
        >
          <ThemedView style={styles.modalContent} lightColor="#fff" darkColor="#1a1a1a">
            <ThemedView style={styles.modalHeader}>
              <ThemedText type="title">
                {editingReport ? 'Edit Report' : 'Create Report'}
              </ThemedText>
              <TouchableOpacity 
                onPress={() => {
                  console.log('[Home] Report modal close button clicked');
                  closeReportModal();
                }}
              >
                <Ionicons name="close" size={24} color={textColor} />
              </TouchableOpacity>
            </ThemedView>

            <ScrollView 
              style={styles.modalBody} 
              contentContainerStyle={styles.modalBodyContent}
              showsVerticalScrollIndicator={false}
            >
              <ThemedView style={styles.inputContainer}>
                <ThemedText style={styles.label}>Project *</ThemedText>
                {projects.length === 0 ? (
                  <ThemedView style={styles.centerContainer}>
                    <ThemedText style={styles.templateDescription}>
                      No projects available. Please create a project first.
                    </ThemedText>
                  </ThemedView>
                ) : (
                  <ThemedView style={styles.projectListContainer}>
                    {projects.map((project) => {
                      const isSelected = reportFormData.project === project.id;
                      return (
                        <TouchableOpacity
                          key={project.id}
                          style={[
                            styles.projectListItem,
                            { borderColor },
                            isSelected && styles.projectListItemSelected,
                          ]}
                          onPress={() => {
                            console.log('[Home] Project selected:', project.name, project.id);
                            handleProjectSelectForReport(project);
                          }}
                        >
                          <ThemedView style={{ flex: 1 }}>
                            <ThemedText style={[styles.projectListItemName, isSelected && { fontWeight: '600' }]}>
                              {project.name}
                            </ThemedText>
                            {project.template_name && (
                              <ThemedText style={styles.templateDescription}>
                                Template: {project.template_name}
                              </ThemedText>
                            )}
                          </ThemedView>
                          {isSelected && (
                            <Ionicons name="checkmark-circle" size={24} color="#0a7ea4" />
                          )}
                        </TouchableOpacity>
                      );
                    })}
                  </ThemedView>
                )}
              </ThemedView>

              {selectedProjectForReport && getTemplateFields().length > 0 && (
                <ThemedView style={styles.inputContainer}>
                  <ThemedText style={styles.label}>Report Data</ThemedText>
                  {getTemplateFields().map((field, index) => (
                    <ThemedView key={index} style={styles.inputContainer}>
                      <ThemedText style={styles.label}>{field.name}</ThemedText>
                      {field.type === 'text' && (
                        <TextInput
                          style={[styles.input, { backgroundColor, color: textColor, borderColor }]}
                          placeholder={`Enter ${field.name}`}
                          placeholderTextColor={placeholderColor}
                          value={reportFormData.data[field.name] || ''}
                          onChangeText={(text) => handleReportFieldChange(field.name, text)}
                        />
                      )}
                      {(field.type === 'time' as any) && (
                        <TextInput
                          style={[styles.input, { backgroundColor, color: textColor, borderColor }]}
                          placeholder="HH:MM"
                          placeholderTextColor={placeholderColor}
                          value={reportFormData.data[field.name] || ''}
                          onChangeText={(text) => handleReportFieldChange(field.name, text)}
                          keyboardType="numeric"
                        />
                      )}
                      {field.type === 'datetime' && (
                        <ThemedView style={styles.datetimeContainer}>
                          <ThemedView style={styles.datetimeRow}>
                            <TouchableOpacity
                              style={[styles.datetimeButton, { backgroundColor, borderColor }]}
                              onPress={() => {
                                const currentValue = reportFormData.data[field.name];
                                const currentDate = currentValue ? new Date(currentValue) : new Date();
                                setDateTimePickers({
                                  ...dateTimePickers,
                                  [field.name]: {
                                    showDate: true,
                                    showTime: false,
                                    date: currentDate,
                                  },
                                });
                              }}
                            >
                              <Ionicons name="calendar-outline" size={20} color={textColor} />
                              <ThemedText style={{ color: textColor, marginLeft: 8 }}>
                                {reportFormData.data[field.name]
                                  ? new Date(reportFormData.data[field.name]).toLocaleDateString()
                                  : 'Select Date'}
                              </ThemedText>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={[styles.datetimeButton, { backgroundColor, borderColor }]}
                              onPress={() => {
                                const currentValue = reportFormData.data[field.name];
                                const currentDate = currentValue ? new Date(currentValue) : new Date();
                                setDateTimePickers({
                                  ...dateTimePickers,
                                  [field.name]: {
                                    showDate: false,
                                    showTime: true,
                                    date: currentDate,
                                  },
                                });
                              }}
                            >
                              <Ionicons name="time-outline" size={20} color={textColor} />
                              <ThemedText style={{ color: textColor, marginLeft: 8 }}>
                                {reportFormData.data[field.name]
                                  ? new Date(reportFormData.data[field.name]).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                                  : 'Select Time'}
                              </ThemedText>
                            </TouchableOpacity>
                          </ThemedView>
                          {dateTimePickers[field.name]?.showDate && Platform.OS !== 'web' && (
                            <DateTimePicker
                              value={dateTimePickers[field.name]?.date || new Date()}
                              mode="date"
                              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                              onChange={(event: any, selectedDate?: Date) => {
                                if (event.type === 'set' && selectedDate) {
                                  const currentValue = reportFormData.data[field.name];
                                  const currentDateTime = currentValue ? new Date(currentValue) : new Date();
                                  const newDate = selectedDate;
                                  newDate.setHours(currentDateTime.getHours());
                                  newDate.setMinutes(currentDateTime.getMinutes());
                                  
                                  handleReportFieldChange(field.name, newDate.toISOString());
                                  setDateTimePickers({
                                    ...dateTimePickers,
                                    [field.name]: {
                                      showDate: false,
                                      showTime: false,
                                      date: newDate,
                                    },
                                  });
                                } else {
                                  setDateTimePickers({
                                    ...dateTimePickers,
                                    [field.name]: {
                                      showDate: false,
                                      showTime: false,
                                      date: dateTimePickers[field.name]?.date || new Date(),
                                    },
                                  });
                                }
                              }}
                            />
                          )}
                          {dateTimePickers[field.name]?.showTime && Platform.OS !== 'web' && (
                            <DateTimePicker
                              value={dateTimePickers[field.name]?.date || new Date()}
                              mode="time"
                              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                              onChange={(event: any, selectedTime?: Date) => {
                                if (event.type === 'set' && selectedTime) {
                                  const currentValue = reportFormData.data[field.name];
                                  const currentDateTime = currentValue ? new Date(currentValue) : new Date();
                                  const newTime = selectedTime;
                                  currentDateTime.setHours(newTime.getHours());
                                  currentDateTime.setMinutes(newTime.getMinutes());
                                  
                                  handleReportFieldChange(field.name, currentDateTime.toISOString());
                                  setDateTimePickers({
                                    ...dateTimePickers,
                                    [field.name]: {
                                      showDate: false,
                                      showTime: false,
                                      date: currentDateTime,
                                    },
                                  });
                                } else {
                                  setDateTimePickers({
                                    ...dateTimePickers,
                                    [field.name]: {
                                      showDate: false,
                                      showTime: false,
                                      date: dateTimePickers[field.name]?.date || new Date(),
                                    },
                                  });
                                }
                              }}
                            />
                          )}
                          {Platform.OS === 'web' && (
                            <ThemedView style={styles.datetimeRow}>
                              <ThemedText style={styles.label}>Date:</ThemedText>
                              <TextInput
                                style={[styles.input, { backgroundColor, color: textColor, borderColor }]}
                                placeholder="YYYY-MM-DD"
                                placeholderTextColor={placeholderColor}
                                value={reportFormData.data[field.name] ? new Date(reportFormData.data[field.name]).toISOString().split('T')[0] : ''}
                                onChangeText={(text) => {
                                  const currentValue = reportFormData.data[field.name];
                                  const currentDateTime = currentValue ? new Date(currentValue) : new Date();
                                  const newDate = new Date(text);
                                  if (!isNaN(newDate.getTime())) {
                                    newDate.setHours(currentDateTime.getHours());
                                    newDate.setMinutes(currentDateTime.getMinutes());
                                    handleReportFieldChange(field.name, newDate.toISOString());
                                  }
                                }}
                              />
                              <ThemedText style={styles.label}>Time:</ThemedText>
                              <TextInput
                                style={[styles.input, { backgroundColor, color: textColor, borderColor }]}
                                placeholder="HH:MM"
                                placeholderTextColor={placeholderColor}
                                value={reportFormData.data[field.name] ? new Date(reportFormData.data[field.name]).toTimeString().slice(0, 5) : ''}
                                onChangeText={(text) => {
                                  const currentValue = reportFormData.data[field.name];
                                  const currentDateTime = currentValue ? new Date(currentValue) : new Date();
                                  const [hours, minutes] = text.split(':');
                                  if (hours && minutes) {
                                    currentDateTime.setHours(parseInt(hours) || 0);
                                    currentDateTime.setMinutes(parseInt(minutes) || 0);
                                    handleReportFieldChange(field.name, currentDateTime.toISOString());
                                  }
                                }}
                              />
                            </ThemedView>
                          )}
                        </ThemedView>
                      )}
                      {field.type === 'choice' && (
                        <TouchableOpacity
                          style={[styles.input, styles.pickerButton, { backgroundColor, borderColor }]}
                          onPress={() => {
                            // Show choice picker
                            Alert.alert(
                              field.name,
                              'Select an option',
                              [
                                ...(field.choices || []).map((choice) => ({
                                  text: choice,
                                  onPress: () => handleReportFieldChange(field.name, choice),
                                })),
                                { text: 'Cancel', style: 'cancel' },
                              ]
                            );
                          }}
                        >
                          <ThemedText style={{ color: reportFormData.data[field.name] ? textColor : placeholderColor }}>
                            {reportFormData.data[field.name] || 'Select option'}
                          </ThemedText>
                          <Ionicons name="chevron-down" size={20} color={textColor} />
                        </TouchableOpacity>
                      )}
                      {field.type === 'file' && (
                        <ThemedView style={styles.fileUploadContainer}>
                          <TouchableOpacity
                            style={[styles.fileUploadButton, { backgroundColor, borderColor }]}
                            onPress={() => handleFileUpload(field.name)}
                            disabled={uploadingFiles[field.name]}
                          >
                            {uploadingFiles[field.name] ? (
                              <>
                                <ActivityIndicator size="small" color={textColor} />
                                <ThemedText style={{ color: textColor, marginLeft: 8 }}>Uploading...</ThemedText>
                              </>
                            ) : (
                              <>
                                <Ionicons name="camera-outline" size={20} color={textColor} />
                                <ThemedText style={{ color: textColor, marginLeft: 8 }}>Add Photos</ThemedText>
                              </>
                            )}
                          </TouchableOpacity>
                          
                          {/* Display uploaded images */}
                          {Array.isArray(reportFormData.data[field.name]) && (reportFormData.data[field.name] as string[]).length > 0 && (
                            <ThemedView style={styles.imageGrid}>
                              {(reportFormData.data[field.name] as string[]).map((fileKey, index) => {
                                const downloadUrl = fileDownloadUrls[field.name]?.[fileKey];
                                return (
                                  <ThemedView key={index} style={styles.imageContainer}>
                                    {downloadUrl ? (
                                      <Image
                                        source={{ uri: downloadUrl }}
                                        style={styles.uploadedImage}
                                        resizeMode="cover"
                                      />
                                    ) : (
                                      <ThemedView style={[styles.uploadedImage, { backgroundColor, justifyContent: 'center', alignItems: 'center' }]}>
                                        <ActivityIndicator size="small" color={textColor} />
                                      </ThemedView>
                                    )}
                                    <TouchableOpacity
                                      style={styles.removeImageButton}
                                      onPress={() => handleRemoveFile(field.name, fileKey)}
                                    >
                                      <Ionicons name="close-circle" size={24} color="#ff4444" />
                                    </TouchableOpacity>
                                  </ThemedView>
                                );
                              })}
                            </ThemedView>
                          )}
                        </ThemedView>
                      )}
                    </ThemedView>
                  ))}
                </ThemedView>
              )}

              {selectedProjectForReport && getTemplateFields().length === 0 && (
                <ThemedView style={styles.centerContainer}>
                  <ThemedText style={styles.templateDescription}>
                    Selected project's template has no fields.
                  </ThemedText>
                </ThemedView>
              )}

              {!selectedProjectForReport && (
                <ThemedView style={styles.centerContainer}>
                  <ThemedText style={styles.templateDescription}>
                    Please select a project to see form fields.
                  </ThemedText>
                </ThemedView>
              )}

              <ThemedView style={styles.modalActions}>
                <TouchableOpacity
                  style={[styles.button, styles.cancelButton, { borderColor }]}
                  onPress={closeReportModal}
                >
                  <ThemedText style={styles.cancelButtonText}>Cancel</ThemedText>
                </TouchableOpacity>
                <TouchableOpacity style={styles.button} onPress={handleSaveReport}>
                  <ThemedText style={styles.buttonText}>Save</ThemedText>
                </TouchableOpacity>
              </ThemedView>
            </ScrollView>
          </ThemedView>
        </KeyboardAvoidingView>
      </Modal>

      {/* Project Filter Picker Modal */}
      <Modal
        visible={projectFilterPickerVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setProjectFilterPickerVisible(false)}
      >
        <TouchableOpacity
          style={styles.pickerOverlay}
          activeOpacity={1}
          onPress={() => setProjectFilterPickerVisible(false)}
        >
          <ThemedView style={styles.pickerContainerWrapper}>
            <ThemedView style={[styles.pickerContainer, { backgroundColor }]}>
              <ThemedView style={styles.pickerHeader}>
                <ThemedText type="subtitle" style={{ color: textColor }}>Filter by Project</ThemedText>
                <TouchableOpacity onPress={() => setProjectFilterPickerVisible(false)}>
                  <Ionicons name="close" size={24} color={textColor} />
                </TouchableOpacity>
              </ThemedView>
              <ScrollView style={styles.pickerScrollView}>
                <TouchableOpacity
                  style={[
                    styles.pickerItem,
                    selectedProjectFilter === null && styles.pickerItemSelected,
                    { borderBottomColor: borderColor }
                  ]}
                  onPress={async () => {
                    setSelectedProjectFilter(null);
                    setProjectFilterPickerVisible(false);
                    // Load reports first, then filters will be applied in loadReports
                    await loadReports(null);
                  }}
                >
                  <ThemedText style={{ color: textColor }}>All Projects</ThemedText>
                  {selectedProjectFilter === null && (
                    <Ionicons name="checkmark" size={20} color="#0a7ea4" />
                  )}
                </TouchableOpacity>
                {projects.map((project) => (
                  <TouchableOpacity
                    key={project.id}
                    style={[
                      styles.pickerItem,
                      selectedProjectFilter === project.id && styles.pickerItemSelected,
                      { borderBottomColor: borderColor }
                    ]}
                    onPress={async () => {
                      setSelectedProjectFilter(project.id);
                      setProjectFilterPickerVisible(false);
                      // Load reports first, then filters will be applied in loadReports
                      await loadReports(project.id);
                    }}
                  >
                    <ThemedText style={{ color: textColor }}>{project.name}</ThemedText>
                    {selectedProjectFilter === project.id && (
                      <Ionicons name="checkmark" size={20} color="#0a7ea4" />
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </ThemedView>
          </ThemedView>
        </TouchableOpacity>
      </Modal>

      {/* Choice Field Picker Modal */}
      <Modal
        visible={choiceFieldPickerVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setChoiceFieldPickerVisible(false)}
      >
        <TouchableOpacity
          style={styles.pickerOverlay}
          activeOpacity={1}
          onPress={() => setChoiceFieldPickerVisible(false)}
        >
          <ThemedView style={styles.pickerContainerWrapper}>
            <ThemedView style={[styles.pickerContainer, { backgroundColor }]}>
              <ThemedView style={styles.pickerHeader}>
                <ThemedText type="subtitle" style={{ color: textColor }}>Select Choice Field</ThemedText>
                <TouchableOpacity onPress={() => setChoiceFieldPickerVisible(false)}>
                  <Ionicons name="close" size={24} color={textColor} />
                </TouchableOpacity>
              </ThemedView>
              <ScrollView style={styles.pickerScrollView}>
                <TouchableOpacity
                  style={[
                    styles.pickerItem,
                    selectedChoiceFieldFilter === null && styles.pickerItemSelected,
                    { borderBottomColor: borderColor }
                  ]}
                  onPress={() => {
                    setSelectedChoiceFieldFilter(null);
                    setSelectedChoiceValueFilter(null);
                    setChoiceFieldPickerVisible(false);
                    applyFilters(allReports, selectedProjectFilter, null, null, sortField, sortDirection);
                  }}
                >
                  <ThemedText style={{ color: textColor }}>None</ThemedText>
                  {selectedChoiceFieldFilter === null && (
                    <Ionicons name="checkmark" size={20} color="#0a7ea4" />
                  )}
                </TouchableOpacity>
                {getAvailableChoiceFields().map((choiceField, index) => (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.pickerItem,
                      selectedChoiceFieldFilter?.fieldName === choiceField.fieldName && styles.pickerItemSelected,
                      { borderBottomColor: borderColor }
                    ]}
                  onPress={() => {
                    setSelectedChoiceFieldFilter({ fieldName: choiceField.fieldName, choices: choiceField.choices });
                    setSelectedChoiceValueFilter(null); // Reset value when field changes
                    setChoiceFieldPickerVisible(false);
                    // Apply filter with no value selected yet
                    applyFilters(allReports, selectedProjectFilter, { fieldName: choiceField.fieldName, choices: choiceField.choices }, null, sortField, sortDirection);
                  }}
                  >
                    <ThemedView>
                      <ThemedText style={{ color: textColor }}>{choiceField.fieldName}</ThemedText>
                      <ThemedText style={{ color: placeholderColor, fontSize: 12 }}>
                        Template: {choiceField.templateName}
                      </ThemedText>
                    </ThemedView>
                    {selectedChoiceFieldFilter?.fieldName === choiceField.fieldName && (
                      <Ionicons name="checkmark" size={20} color="#0a7ea4" />
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </ThemedView>
          </ThemedView>
        </TouchableOpacity>
      </Modal>

      {/* Choice Value Picker Modal */}
      <Modal
        visible={choiceValuePickerVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setChoiceValuePickerVisible(false)}
      >
        <TouchableOpacity
          style={styles.pickerOverlay}
          activeOpacity={1}
          onPress={() => setChoiceValuePickerVisible(false)}
        >
          <ThemedView style={styles.pickerContainerWrapper}>
            <ThemedView style={[styles.pickerContainer, { backgroundColor }]}>
              <ThemedView style={styles.pickerHeader}>
                <ThemedText type="subtitle" style={{ color: textColor }}>
                  Select Value for {selectedChoiceFieldFilter?.fieldName}
                </ThemedText>
                <TouchableOpacity onPress={() => setChoiceValuePickerVisible(false)}>
                  <Ionicons name="close" size={24} color={textColor} />
                </TouchableOpacity>
              </ThemedView>
              <ScrollView style={styles.pickerScrollView}>
                <TouchableOpacity
                  style={[
                    styles.pickerItem,
                    selectedChoiceValueFilter === null && styles.pickerItemSelected,
                    { borderBottomColor: borderColor }
                  ]}
                  onPress={() => {
                    setSelectedChoiceValueFilter(null);
                    setChoiceValuePickerVisible(false);
                    applyFilters(allReports, selectedProjectFilter, selectedChoiceFieldFilter, null, sortField, sortDirection);
                  }}
                >
                  <ThemedText style={{ color: textColor }}>All Values</ThemedText>
                  {selectedChoiceValueFilter === null && (
                    <Ionicons name="checkmark" size={20} color="#0a7ea4" />
                  )}
                </TouchableOpacity>
                {selectedChoiceFieldFilter?.choices.map((choice, index) => (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.pickerItem,
                      selectedChoiceValueFilter === choice && styles.pickerItemSelected,
                      { borderBottomColor: borderColor }
                    ]}
                    onPress={() => {
                      setSelectedChoiceValueFilter(choice);
                      setChoiceValuePickerVisible(false);
                      applyFilters(allReports, selectedProjectFilter, selectedChoiceFieldFilter, choice, sortField, sortDirection);
                    }}
                  >
                    <ThemedText style={{ color: textColor }}>{choice}</ThemedText>
                    {selectedChoiceValueFilter === choice && (
                      <Ionicons name="checkmark" size={20} color="#0a7ea4" />
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </ThemedView>
          </ThemedView>
        </TouchableOpacity>
      </Modal>

      {/* Sort Field Picker Modal */}
      <Modal
        visible={sortFieldPickerVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setSortFieldPickerVisible(false)}
      >
        <TouchableOpacity
          style={styles.pickerOverlay}
          activeOpacity={1}
          onPress={() => setSortFieldPickerVisible(false)}
        >
          <ThemedView style={styles.pickerContainerWrapper}>
            <ThemedView style={[styles.pickerContainer, { backgroundColor }]}>
              <ThemedView style={styles.pickerHeader}>
                <ThemedText type="subtitle" style={{ color: textColor }}>Sort By</ThemedText>
                <TouchableOpacity onPress={() => setSortFieldPickerVisible(false)}>
                  <Ionicons name="close" size={24} color={textColor} />
                </TouchableOpacity>
              </ThemedView>
              <ScrollView style={styles.pickerScrollView}>
                <TouchableOpacity
                  style={[
                    styles.pickerItem,
                    sortField === 'created_at' && styles.pickerItemSelected,
                    { borderBottomColor: borderColor }
                  ]}
                  onPress={() => {
                    setSortField('created_at');
                    setSortFieldPickerVisible(false);
                    applyFilters(allReports, selectedProjectFilter, selectedChoiceFieldFilter, selectedChoiceValueFilter, 'created_at', sortDirection);
                  }}
                >
                  <ThemedText style={{ color: textColor }}>Created At</ThemedText>
                  {sortField === 'created_at' && (
                    <Ionicons name="checkmark" size={20} color="#0a7ea4" />
                  )}
                </TouchableOpacity>
                {getAvailableDateTimeFields().map((datetimeField, index) => (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.pickerItem,
                      sortField === datetimeField.fieldName && styles.pickerItemSelected,
                      { borderBottomColor: borderColor }
                    ]}
                    onPress={() => {
                      setSortField(datetimeField.fieldName);
                      setSortFieldPickerVisible(false);
                      applyFilters(allReports, selectedProjectFilter, selectedChoiceFieldFilter, selectedChoiceValueFilter, datetimeField.fieldName, sortDirection);
                    }}
                  >
                    <ThemedView>
                      <ThemedText style={{ color: textColor }}>{datetimeField.fieldName}</ThemedText>
                      <ThemedText style={{ color: placeholderColor, fontSize: 12 }}>
                        Template: {datetimeField.templateName}
                      </ThemedText>
                    </ThemedView>
                    {sortField === datetimeField.fieldName && (
                      <Ionicons name="checkmark" size={20} color="#0a7ea4" />
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </ThemedView>
          </ThemedView>
        </TouchableOpacity>
      </Modal>

    </ParallaxScrollView>
  );
}

const styles = StyleSheet.create({
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingVertical: 8,
  },
  stepContainer: {
    gap: 8,
    marginBottom: 8,
  },
  fireIconContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    height: '100%',
  },
  buttonContainer: {
    marginBottom: 20,
  },
  createButton: {
    backgroundColor: '#0a7ea4',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderRadius: 8,
    gap: 8,
  },
  createButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  centerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    gap: 16,
  },
  loadingText: {
    marginTop: 8,
  },
  templatesContainer: {
    gap: 12,
  },
  templateCard: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 16,
    gap: 8,
  },
  templateHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  templateActions: {
    flexDirection: 'row',
    gap: 12,
  },
  iconButton: {
    padding: 4,
  },
  templateDescription: {
    opacity: 0.7,
    fontSize: 14,
  },
  fieldCount: {
    fontSize: 12,
    opacity: 0.6,
    marginTop: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '85%',
    width: '100%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalBody: {
    flexGrow: 0,
  },
  modalBodyContent: {
    paddingBottom: 20,
  },
  inputContainer: {
    marginBottom: 20,
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    minHeight: 48,
  },
  textArea: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  addFieldButtons: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  addFieldButton: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  addFieldButtonText: {
    fontSize: 14,
  },
  fieldCard: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    gap: 8,
  },
  fieldHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  fieldType: {
    fontSize: 12,
    fontWeight: '600',
    opacity: 0.7,
  },
  choicesContainer: {
    marginTop: 8,
    gap: 8,
  },
  choicesLabel: {
    fontSize: 12,
    fontWeight: '600',
    opacity: 0.7,
  },
  choiceItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    borderRadius: 6,
  },
  choiceText: {
    flex: 1,
    fontSize: 14,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 1,
  },
  button: {
    flex: 1,
    backgroundColor: '#0a7ea4',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  pickerButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    height: '100%',
  },
  pickerContainerWrapper: {
    width: '85%',
    maxHeight: '70%',
    zIndex: 1000,
    elevation: 10, // For Android
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
    justifyContent: 'flex-start',
    alignItems: 'stretch',
  },
  pickerContainer: {
    width: '100%',
    borderRadius: 12,
    padding: 20,
    minHeight: 200,
    maxHeight: '100%',
  },
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  pickerItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    minHeight: 50,
  },
  pickerItemSelected: {
    backgroundColor: 'rgba(10, 126, 164, 0.1)',
  },
  projectListContainer: {
    gap: 8,
  },
  projectListItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    minHeight: 60,
  },
  projectListItemSelected: {
    borderColor: '#0a7ea4',
    borderWidth: 2,
    backgroundColor: 'rgba(10, 126, 164, 0.05)',
  },
  projectListItemName: {
    fontSize: 16,
    marginBottom: 4,
  },
  datetimeContainer: {
    gap: 12,
  },
  datetimeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  datetimeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    minHeight: 48,
  },
  pickerScrollView: {
    maxHeight: 400,
  },
  fileUploadContainer: {
    gap: 12,
  },
  fileUploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    minHeight: 48,
  },
  imageGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 8,
  },
  imageContainer: {
    position: 'relative',
    width: 100,
    height: 100,
  },
  uploadedImage: {
    width: 100,
    height: 100,
    borderRadius: 8,
    overflow: 'hidden',
  },
  removeImageButton: {
    position: 'absolute',
    top: -6,
    right: -6,
    zIndex: 10,
    elevation: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 12,
  },
  filterContainer: {
    gap: 12,
    marginBottom: 16,
  },
  clearFilterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    marginTop: 8,
  },
  sortDirectionContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  sortDirectionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    minHeight: 48,
  },
});
