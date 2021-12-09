from enum import Enum

from django.db import models
from django.utils import timezone

from sentry.db.models import (
    BoundedBigIntegerField,
    BoundedPositiveIntegerField,
    FlexibleForeignKey,
    Model,
)


class Feature:
    API = 0
    ISSUE_LINK = 1
    STACKTRACE_LINK = 2
    EVENT_HOOKS = 3
    PROJECT_MANAGEMENT = 4
    INCIDENT_MANAGEMENT = 5
    FEATURE_FLAG = 6
    ALERTS = 7

    @classmethod
    def as_choices(cls):
        return (
            (cls.API, "integrations-api"),
            (cls.ISSUE_LINK, "integrations-issue-link"),
            (cls.STACKTRACE_LINK, "integrations-stacktrace-link"),
            (cls.EVENT_HOOKS, "integrations-event-hooks"),
            (cls.PROJECT_MANAGEMENT, "integrations-project-management"),
            (cls.INCIDENT_MANAGEMENT, "integrations-incident-management"),
            (cls.FEATURE_FLAG, "integrations-feature-flag"),
            (cls.ALERTS, "integrations-alert-rule"),
        )

    @classmethod
    def as_str(cls, feature):
        if feature == cls.ISSUE_LINK:
            return "integrations-issue-link"
        if feature == cls.STACKTRACE_LINK:
            return "integrations-stacktrace-link"
        if feature == cls.EVENT_HOOKS:
            return "integrations-event-hooks"
        if feature == cls.PROJECT_MANAGEMENT:
            return "integrations-project-management"
        if feature == cls.INCIDENT_MANAGEMENT:
            return "integrations-incident-management"
        if feature == cls.FEATURE_FLAG:
            return "integrations-feature-flag"
        if feature == cls.ALERTS:
            return "integrations-alert-rule"
        return "integrations-api"

    @classmethod
    def description(cls, feature, name):
        if feature == cls.PROJECT_MANAGEMENT:
            return "Create or link issues in %s from Sentry issue groups." % name
        if feature == cls.INCIDENT_MANAGEMENT:
            return "Manage incidents and outages by sending Sentry notifications to %s." % name
        if feature == cls.FEATURE_FLAG:
            return "Improve visibility into feature flagging by sending Sentry errors to %s." % name
        if feature == cls.ISSUE_LINK:
            return "Organizations can **create or link Sentry issues** to another service."
        if feature == cls.STACKTRACE_LINK:
            return "Organizations can **open a line to Sentry's stack trace** in another service."
        if feature == cls.EVENT_HOOKS:
            return "%s allows organizations to **forward events to another service**." % name
        if feature == cls.ALERTS:
            return "Configure Sentry alerts to trigger notifications in %s." % name
        # default
        return (
            "%s can **utilize the Sentry API** to pull data or update resources in Sentry (with permissions granted, of course)."
            % name
        )


class IntegrationTypes(Enum):
    SENTRY_APP = 0
    DOC_INTEGRATION = 1


class IntegrationFeature(Model):
    __include_in_export__ = False

    sentry_app = FlexibleForeignKey("sentry.SentryApp", null=True)
    # the id of the sentry_app or doc_integration
    # TODO(CEO): change this to null=False
    target_id = BoundedBigIntegerField(null=True)
    target_type = BoundedPositiveIntegerField(
        default=0,
        null=True,
        choices=(
            (IntegrationTypes.SENTRY_APP, "sentry_app"),
            (IntegrationTypes.DOC_INTEGRATION, "doc_integration"),
        ),
    )
    user_description = models.TextField(null=True)
    feature = BoundedPositiveIntegerField(default=0, choices=Feature.as_choices())
    date_added = models.DateTimeField(default=timezone.now)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_integrationfeature"
        unique_together = (("sentry_app", "feature"),)

    def feature_str(self):
        return Feature.as_str(self.feature)

    @property
    def description(self):
        if self.user_description:
            return self.user_description
        return Feature.description(self.feature, self.sentry_app.name)
