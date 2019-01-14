import matplotlib.pyplot as plt
import numpy as np
import pylab as pl
from scipy import ndimage
from sklearn.cluster import KMeans
 
img = ndimage.imread('picture.png')
img_size = img.shape
 
X = img.reshape(img_size[0] * img_size[1], img_size[2])
 
km = KMeans(n_clusters=7)
km.fit(X)
 
X_compressed = km.cluster_centers_[km.labels_]
X_compressed = np.clip(X_compressed.astype('uint8'), 0, 255)
 
X_compressed = X_compressed.reshape(img_size[0], img_size[1], img_size[2])
 
fig, ax = plt.subplots(1, 2, figsize=(12, 8))
ax[0].imshow(img)
ax[0].set_title('Original image')
ax[1].imshow(X_compressed)
ax[1].set_title('Compressed image')
for ax in fig.axes:
    ax.axis('off')
plt.tight_layout()
 
plt.show()