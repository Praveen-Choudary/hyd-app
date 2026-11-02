#!/usr/bin/env bash
# Usage: AWS_REGION=ap-south-2 ./deploy-eks.sh [tag]
# Prereqs: aws cli, docker, kubectl, an EKS cluster with the AWS Load Balancer Controller installed.
set -euo pipefail
REGION=${AWS_REGION:-ap-south-1}
export TAG=${1:-$(date +%Y%m%d%H%M)}
ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
export ECR=$ACCOUNT.dkr.ecr.$REGION.amazonaws.com
aws ecr get-login-password --region $REGION | docker login --username AWS --password-stdin $ECR
for s in catalog orders frontend; do
  aws ecr describe-repositories --repository-names hyd-shop/$s --region $REGION >/dev/null 2>&1 \
    || aws ecr create-repository --repository-name hyd-shop/$s --region $REGION >/dev/null
  docker build --platform linux/amd64 -t $ECR/hyd-shop/$s:$TAG ./$s
  docker push $ECR/hyd-shop/$s:$TAG
done
envsubst < k8s-eks/app.yaml | kubectl apply -f -
kubectl -n hyd-shop rollout status deploy/frontend
echo "ALB address (takes 2-3 min to appear):"
kubectl -n hyd-shop get ingress hyd-shop -o jsonpath='{.status.loadBalancer.ingress[0].hostname}{"\n"}'
