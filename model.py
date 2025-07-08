import torch
import torch.nn as nn
import torch.nn.functional as F
from torchvision.models import resnet34
from torchvision.models.feature_extraction import create_feature_extractor

class FireSegmentationModel(nn.Module):
    def __init__(self):
        super(FireSegmentationModel, self).__init__()
        
        # ResNet34 backbone
        backbone = resnet34(pretrained=True)
        self.backbone = create_feature_extractor(
            backbone,
            return_nodes={
                'layer1': 'feat1',  # 64 channels
                'layer2': 'feat2',  # 128 channels
                'layer3': 'feat3',  # 256 channels
                'layer4': 'feat4'   # 512 channels
            }
        )
        
        # Lateral connections for FPN
        self.lateral4 = nn.Conv2d(512, 256, kernel_size=1)
        self.lateral3 = nn.Conv2d(256, 256, kernel_size=1)
        self.lateral2 = nn.Conv2d(128, 256, kernel_size=1)
        self.lateral1 = nn.Conv2d(64, 256, kernel_size=1)
        
        # Smooth layers
        self.smooth4 = nn.Conv2d(256, 256, kernel_size=3, padding=1)
        self.smooth3 = nn.Conv2d(256, 256, kernel_size=3, padding=1)
        self.smooth2 = nn.Conv2d(256, 256, kernel_size=3, padding=1)
        self.smooth1 = nn.Conv2d(256, 256, kernel_size=3, padding=1)
        
        # Final layers
        self.final = nn.Sequential(
            nn.Conv2d(256, 128, kernel_size=3, padding=1),
            nn.BatchNorm2d(128),
            nn.ReLU(inplace=True),
            nn.Conv2d(128, 64, kernel_size=3, padding=1),
            nn.BatchNorm2d(64),
            nn.ReLU(inplace=True),
            nn.Conv2d(64, 1, kernel_size=1)
        )
        
    def forward(self, x):
        # Get features from backbone
        features = self.backbone(x)
        
        # FPN top-down pathway
        feat4 = self.lateral4(features['feat4'])
        feat3 = self.lateral3(features['feat3'])
        feat2 = self.lateral2(features['feat2'])
        feat1 = self.lateral1(features['feat1'])
        
        # Top-down pathway with lateral connections
        feat3 = feat3 + F.interpolate(feat4, size=feat3.shape[-2:], mode='bilinear', align_corners=False)
        feat2 = feat2 + F.interpolate(feat3, size=feat2.shape[-2:], mode='bilinear', align_corners=False)
        feat1 = feat1 + F.interpolate(feat2, size=feat1.shape[-2:], mode='bilinear', align_corners=False)
        
        # Smooth
        p4 = self.smooth4(feat4)
        p3 = self.smooth3(feat3)
        p2 = self.smooth2(feat2)
        p1 = self.smooth1(feat1)
        
        # Final prediction
        out = F.interpolate(p1, size=x.shape[-2:], mode='bilinear', align_corners=False)
        out = self.final(out)
        
        return torch.sigmoid(out)
