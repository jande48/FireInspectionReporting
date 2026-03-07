from rest_framework import serializers
from .models import Template


class TemplateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Template
        fields = ['id', 'name', 'description', 'fields', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']

    def validate_fields(self, value):
        """
        Validate that fields is a list of field objects with proper structure.
        Each field should have:
        - type: 'time', 'text', or 'choice'
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
            
            if not field_type or field_type not in ['time', 'text', 'choice']:
                raise serializers.ValidationError(
                    f"Field type must be 'time', 'text', or 'choice'. Got: {field_type}"
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
