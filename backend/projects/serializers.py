from rest_framework import serializers
from .models import Template, Project, Report


class TemplateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Template
        fields = ['id', 'name', 'description', 'fields', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']

    def validate_fields(self, value):
        """
        Validate that fields is a list of field objects with proper structure.
        Each field should have:
        - type: 'text', 'choice', or 'datetime'
        - name: string
        - choices: list (only for 'choice' type)
        """
        if not isinstance(value, list):
            raise serializers.ValidationError("Fields must be a list.")
        
        for field in value:
            if not isinstance(field, dict):
                raise serializers.ValidationError("Each field must be an object.")
            
            field_type = field.get('type')
            field_name = field.get('name')
            
            if not field_type or field_type not in ['text', 'choice', 'datetime']:
                raise serializers.ValidationError(
                    f"Field type must be 'text', 'choice', or 'datetime'. Got: {field_type}"
                )
            
            if not field_name or not isinstance(field_name, str):
                raise serializers.ValidationError("Each field must have a 'name' string.")
            
            if field_type == 'choice':
                choices = field.get('choices')
                if not choices or not isinstance(choices, list):
                    raise serializers.ValidationError(
                        "Choice fields must have a 'choices' list."
                    )
        
        return value


class ProjectSerializer(serializers.ModelSerializer):
    template_name = serializers.CharField(source='template.name', read_only=True)
    
    class Meta:
        model = Project
        fields = ['id', 'name', 'description', 'template', 'template_name', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at', 'template_name']

    def validate_template(self, value):
        """
        Ensure the template belongs to the requesting user.
        This validation happens in the view, but we can add it here too for safety.
        """
        request = self.context.get('request')
        if request and hasattr(request, 'user'):
            if value.user != request.user:
                raise serializers.ValidationError("You can only use your own templates.")
        return value


class ReportSerializer(serializers.ModelSerializer):
    project_name = serializers.CharField(source='project.name', read_only=True)
    template_fields = serializers.SerializerMethodField()
    
    class Meta:
        model = Report
        fields = ['id', 'project', 'project_name', 'data', 'template_fields', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at', 'project_name', 'template_fields']

    def get_template_fields(self, obj):
        """Return the template fields so frontend can render the form"""
        if obj.project and obj.project.template:
            return obj.project.template.fields
        return []

    def validate_data(self, value):
        """
        Validate that data matches the template fields structure.
        Data should be a dictionary with keys matching field names.
        """
        if not isinstance(value, dict):
            raise serializers.ValidationError("Data must be a dictionary.")
        
        # Get template fields from project if available
        request = self.context.get('request')
        project_id = self.initial_data.get('project') if hasattr(self, 'initial_data') else None
        
        if project_id:
            try:
                project = Project.objects.get(id=project_id)
                template_fields = project.template.fields
                
                # Validate that all required fields are present
                for field in template_fields:
                    field_name = field.get('name')
                    if field_name and field_name not in value:
                        # Field is missing, but we'll allow it (could be optional)
                        pass
                
                # Validate field values match their types
                for field_name, field_value in value.items():
                    # Find the corresponding template field
                    template_field = next((f for f in template_fields if f.get('name') == field_name), None)
                    if template_field:
                        field_type = template_field.get('type')
                        if field_type == 'choice':
                            choices = template_field.get('choices', [])
                            if field_value not in choices:
                                raise serializers.ValidationError(
                                    f"Value '{field_value}' is not a valid choice for field '{field_name}'"
                                )
            except Project.DoesNotExist:
                pass  # Project validation will happen in the view
        
        return value
