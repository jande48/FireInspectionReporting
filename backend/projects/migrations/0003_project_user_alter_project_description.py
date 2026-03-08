# Generated manually

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('projects', '0002_template_user_alter_template_description_alter_template_fields'),
    ]

    operations = [
        migrations.AddField(
            model_name='project',
            name='user',
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE,
                related_name='projects',
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.AlterField(
            model_name='project',
            name='description',
            field=models.TextField(blank=True),
        ),
        migrations.AlterField(
            model_name='project',
            name='template',
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE,
                related_name='projects',
                to='projects.template',
            ),
        ),
        migrations.AlterModelOptions(
            name='project',
            options={'ordering': ['-created_at']},
        ),
    ]
