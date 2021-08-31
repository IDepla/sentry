# Generated by Django 2.1.15 on 2021-08-24 13:26

from enum import Enum

from django.db import migrations

from sentry.utils.query import RangeQuerySetWrapperWithProgressBar


class UserOptionValue:
    # 'workflow:notifications'
    all_conversations = "0"
    participating_only = "1"
    no_conversations = "2"
    # 'deploy-emails
    all_deploys = "2"
    committed_deploys_only = "3"
    no_deploys = "4"


class ExternalProviders(Enum):
    GITHUB = 0
    GITLAB = 1
    EMAIL = 100
    SLACK = 110


class NotificationScopeType(Enum):
    USER = 0
    ORGANIZATION = 10
    PROJECT = 20


class NotificationSettingTypes(Enum):
    # top level config of on/off
    # for workflow also includes SUBSCRIBE_ONLY
    # for deploy also includes COMMITTED_ONLY
    DEFAULT = 0
    # send deploy notifications
    DEPLOY = 10
    # notifications for issues
    ISSUE_ALERTS = 20
    # notifications for changes in assignment, resolution, comments
    WORKFLOW = 30
    # Weekly user reports.
    REPORTS = 40


class NotificationSettingOptionValues(Enum):
    DEFAULT = 0  # Defer to a setting one level up.
    NEVER = 10
    ALWAYS = 20
    SUBSCRIBE_ONLY = 30  # workflow
    COMMITTED_ONLY = 40  # deploy


def copy_useroption_to_notificationsetting(apps, schema_editor):
    UserOption = apps.get_model("sentry", "UserOption")
    User = apps.get_model("sentry", "User")
    NotificationSetting = apps.get_model("sentry", "NotificationSetting")
    for user_option in RangeQuerySetWrapperWithProgressBar(UserOption.objects.all()):
        if user_option.key == "reports:disabled-organizations":
            user = User.objects.select_related("actor").get(id=user_option.user_id)
            for organization_id in set(user_option.value or []):
                if organization_id:  # ignore "0"
                    NotificationSetting.objects.update_or_create(
                        scope_type=NotificationScopeType.ORGANIZATION.value,
                        scope_identifier=organization_id,
                        target=user.actor,
                        provider=ExternalProviders.EMAIL.value,  # 100
                        type=NotificationSettingTypes.REPORTS,
                        defaults={"value": NotificationSettingOptionValues.NEVER.value},
                    )
        else:
            continue


class Migration(migrations.Migration):
    # This flag is used to mark that a migration shouldn't be automatically run in
    # production. We set this to True for operations that we think are risky and want
    # someone from ops to run manually and monitor.
    # General advice is that if in doubt, mark your migration as `is_dangerous`.
    # Some things you should always mark as dangerous:
    # - Large data migrations. Typically we want these to be run manually by ops so that
    #   they can be monitored. Since data migrations will now hold a transaction open
    #   this is even more important.
    # - Adding columns to highly active tables, even ones that are NULL.
    is_dangerous = True
    # This flag is used to decide whether to run this migration in a transaction or not.
    # By default we prefer to run in a transaction, but for migrations where you want
    # to `CREATE INDEX CONCURRENTLY` this needs to be set to False. Typically you'll
    # want to create an index concurrently when adding one to an existing table.
    # You'll also usually want to set this to `False` if you're writing a data
    # migration, since we don't want the entire migration to run in one long-running
    # transaction.
    atomic = False
    dependencies = [
        ("sentry", "0226_add_visits"),
    ]
    operations = [
        migrations.RunPython(
            copy_useroption_to_notificationsetting,
            reverse_code=migrations.RunPython.noop,
            hints={"tables": ["sentry_notificationsetting"]},
        )
    ]
