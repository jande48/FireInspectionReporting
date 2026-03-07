# Generated manually

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('projects', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='template',
            name='user',
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE,
                related_name='templates',
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.AlterField(
            model_name='template',
            name='description',
            field=models.TextField(blank=True),
        ),
        migrations.AlterField(
            model_name='template',
            name='fields',
            field=models.JSONField(default=list),
        ),
        migrations.AlterModelOptions(
            name='template',
            options={'ordering': ['-created_at']},
        ),
    ]
