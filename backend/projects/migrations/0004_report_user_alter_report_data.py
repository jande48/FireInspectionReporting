# Generated manually

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('projects', '0003_project_user_alter_project_description'),
    ]

    operations = [
        migrations.AddField(
            model_name='report',
            name='user',
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE,
                related_name='reports',
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.AlterField(
            model_name='report',
            name='data',
            field=models.JSONField(default=dict),
        ),
        migrations.AlterField(
            model_name='report',
            name='project',
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE,
                related_name='reports',
                to='projects.project',
            ),
        ),
        migrations.AlterModelOptions(
            name='report',
            options={'ordering': ['-created_at']},
        ),
    ]
