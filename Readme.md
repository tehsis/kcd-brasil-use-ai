# Use AI and Keep Your CISO Happy: Zero static secrets with OIDC and the Operator Pattern

This repo contains the material for the talk delivered in KCD São Paolo 2026.

## Demo

In the `app` folder you can find a simple set of kubernetes manifests that serve as example on how to Use
credentials managed by Pulumi ESC on a kubernetes cluster.

### How to run it

The demo is intended to run within a local cluster (eg. minikube) although it should just work on any cluster.

You need to have [External secrets operator](https://external-secrets.io/) installed.

```
helm repo add external-secrets https://charts.external-secrets.io

helm install external-secrets \
   external-secrets/external-secrets \
    -n external-secrets \
    --create-namespace 
```

You also need to store a Pulumi access token in the cluster. 

**Note**: In a real world scenario you want to rely on OIDC to fetch the token. Check the [official documentation](https://external-secrets.io/latest/provider/pulumi/) for full details.

```
kubectl create secret generic my-pu-secret --from-literal=pu-at=<pulumi-token>
```

You also need to setup an ESC Enviroment with an AWS dynamic credentials definition: https://www.pulumi.com/docs/esc/guides/configuring-oidc/aws/ 

Make sure to also setup the trust relationship on your aws account. You can find an example of how to do it through Pulumi IaC on the `iac` folder.


Then, modify `external-secret-store.yaml` with your organization and environment details.


finally, create the cluster:

```
kubectl apply -f .
```

If everything goes right, you should be able to check the logs from the pod created and see your s3 buckets.

