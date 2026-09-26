# Pulumi ESC AWS trust example

This program provisions Pulumi's AWS IAM OIDC provider and an IAM role for
`logmeup/kcd-brasil/dev-s3-read-only`. The role trusts only that environment and
attaches `AmazonS3ReadOnlyAccess` for read-only access across S3 buckets, subject
to other applicable AWS policies.

## Prerequisites

- Node.js, npm, Pulumi CLI, and AWS CLI
- Pulumi Cloud login and AWS credentials with permission to manage IAM providers,
  roles, and policy attachments

Run commands from `app/iac` with the intended AWS account/profile selected:

```sh
npm ci
pulumi stack select demo
aws sts get-caller-identity
```

If AWS SSO credentials have expired, run `aws sso login` first (include
`--profile <profile>` if needed).

## Existing OIDC provider

AWS permits only one provider per issuer URL per account. For an account that
already has `api.pulumi.com/oidc`, import it rather than creating a duplicate.
First inspect it, replacing `<account-id>`:

```sh
aws iam get-open-id-connect-provider \
  --open-id-connect-provider-arn arn:aws:iam::<account-id>:oidc-provider/api.pulumi.com/oidc
pulumi config set existingOidcProviderArn arn:aws:iam::<account-id>:oidc-provider/api.pulumi.com/oidc
```

Preserve **every** entry from the returned `ClientIDList` in configuration. For
example, if the existing audiences are `logmeup` and `aws:logmeup`:

```sh
pulumi config set --path 'existingOidcAudiences[0]' logmeup
pulumi config set --path 'existingOidcAudiences[1]' aws:logmeup
```

The program adds `aws:logmeup` and deduplicates the list. Inspect the preview
before applying: it should not remove audiences needed by other integrations.
The import makes this stack responsible for the provider's lifecycle, including
deletion. If another IaC stack manages it, reference its provider instead of
importing it into a second stack.

For a fresh AWS account, omit the import configuration; the same resource
definition creates the provider.

## Deploy

```sh
npx tsc --noEmit
pulumi preview
pulumi up
pulumi stack output roleArn
```

After a successful import, remove the one-time import setting:

```sh
pulumi config rm existingOidcProviderArn
```

Keep `existingOidcAudiences` configured to retain the provider's other audiences.

## Configure the ESC environment

In `logmeup/kcd-brasil/dev-s3-read-only`, configure the following values, replacing
`<role-arn>` with the `roleArn` stack output:

```yaml
values:
  aws:
    login:
      fn::open::aws-login:
        oidc:
          roleArn: <role-arn>
          sessionName: pulumi-esc
          duration: 1h
          subjectAttributes:
            - currentEnvironment.name
  environmentVariables:
    AWS_ACCESS_KEY_ID: ${aws.login.accessKeyId}
    AWS_SECRET_ACCESS_KEY: ${aws.login.secretAccessKey}
    AWS_SESSION_TOKEN: ${aws.login.sessionToken}
    AWS_REGION: us-east-1
```

`subjectAttributes` is required: it produces the exact environment-specific
subject matched by the role's trust policy. The audience is `aws:logmeup`.
The Pulumi program creates AWS resources; configure the ESC environment separately
with this YAML.

Validate temporary credentials and S3 access:

```sh
pulumi env run logmeup/kcd-brasil/dev-s3-read-only -- aws sts get-caller-identity
pulumi env run logmeup/kcd-brasil/dev-s3-read-only -- aws s3 ls
```
