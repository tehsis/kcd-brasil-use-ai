import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";

const config = new pulumi.Config();
const organization = "logmeup";
const environment = "kcd-brasil/dev-s3-read-only";
const issuer = "api.pulumi.com/oidc";
const audience = `aws:${organization}`;

// For an existing provider, supply its ARN and preserve all existing audiences.
const provider = new aws.iam.OpenIdConnectProvider("pulumi-esc", {
    url: `https://${issuer}`,
    clientIdLists: Array.from(new Set([
        audience,
        ...(config.getObject<string[]>("existingOidcAudiences") ?? []),
    ])),
}, {
    import: config.get("existingOidcProviderArn"),
});

const role = new aws.iam.Role("dev-s3-read-only", {
    description: `S3 read-only access for Pulumi ESC ${organization}/${environment}`,
    assumeRolePolicy: provider.arn.apply(arn => JSON.stringify({
        Version: "2012-10-17",
        Statement: [{
            Effect: "Allow",
            Principal: { Federated: arn },
            Action: "sts:AssumeRoleWithWebIdentity",
            Condition: {
                StringEquals: {
                    [`${issuer}:aud`]: audience,
                    [`${issuer}:sub`]: `pulumi:environments:pulumi.organization.login:${organization}:currentEnvironment.name:${environment}`,
                },
            },
        }],
    })),
});

new aws.iam.RolePolicyAttachment("s3-read-only", {
    role: role.name,
    policyArn: aws.iam.ManagedPolicy.AmazonS3ReadOnlyAccess,
});

export const oidcProviderArn = provider.arn;
export const roleArn = role.arn;
