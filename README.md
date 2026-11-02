# Lakh Bazaar - Hyderabad e-commerce (frontend + catalog + orders)

## 1. Run locally with Docker Compose
    docker compose up --build -d
    open http://localhost:8080
    docker compose logs -f      # logs
    docker compose down         # stop

## 2. Deploy to Amazon EKS
    aws eks update-kubeconfig --name <cluster> --region <region>
    AWS_REGION=<region> ./deploy-eks.sh
Needs the AWS Load Balancer Controller on the cluster (creates the ALB from the Ingress).
The script builds linux/amd64 images, pushes them to ECR, applies k8s-eks/app.yaml.
Cleanup: kubectl delete ns hyd-shop

## 3. Quick local Kubernetes (no registry): ./deploy.sh  (minikube/kind/Docker Desktop)

## 4. Jenkins (E2E Networks Kubernetes)
Jenkinsfile + k8s-e2e/app.yaml. See the chat instructions for credentials and agent tools.
Run "Build with Parameters": ACTION = DEPLOY | ROLLBACK | RESTART | SCALE | STATUS | DESTROY.
